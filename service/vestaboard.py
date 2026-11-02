"""Vestaboard Local API client and a small local VBML composer.

The frame never receives the Local API key. StartOS stores the board address
and key, and this module talks only to a private-LAN board on port 7000.
"""
import ipaddress
import json
import re
import socket
import urllib.error
import urllib.parse
import urllib.request

LOCAL_API_PORT = 7000
MAX_RESPONSE_BYTES = 64 * 1024
BOARD_SIZES = {"flagship": (6, 22), "note": (3, 15)}
MAX_COMPONENTS = 20

LETTERS = {chr(65 + i): i + 1 for i in range(26)}
DIGITS = {"1": 27, "2": 28, "3": 29, "4": 30, "5": 31, "6": 32,
          "7": 33, "8": 34, "9": 35, "0": 36}
PUNCTUATION = {"!": 37, "@": 38, "#": 39, "$": 40, "(": 41, ")": 42,
               "-": 44, "+": 46, "&": 47, "=": 48, ";": 49, ":": 50,
               "'": 52, '"': 53, "%": 54, ",": 55, ".": 56, "/": 59,
               "?": 60}
SPECIAL = {"°": 62, "❤": 62, "♥": 62}


class VestaboardError(Exception):
    """A configuration, validation, or board communication failure.

    ``status`` is the HTTP status returned by the board, if any. A missing
    status means the request was rejected before it reached the board.
    """

    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


def settings(config):
    """Normalized board settings from config.json. The key stays server-side."""
    board = config.get("vestaboard") or {}
    if not isinstance(board, dict):
        board = {}
    name = str(board.get("board") or "flagship").strip().lower()
    rows, cols = BOARD_SIZES.get(name, BOARD_SIZES["flagship"])
    return {
        "host": str(board.get("host") or "").strip(),
        "apiKey": str(board.get("apiKey") or "").strip(),
        "board": name if name in BOARD_SIZES else "flagship",
        "rows": rows,
        "cols": cols,
    }


def public_settings(config):
    """Status-safe settings: never includes the Local API key."""
    current = settings(config)
    return {
        "configured": bool(current["host"] and current["apiKey"]),
        "host": current["host"],
        "board": current["board"],
        "rows": current["rows"],
        "cols": current["cols"],
        "apiKeyConfigured": bool(current["apiKey"]),
    }


def _is_private_ipv4(value):
    try:
        address = ipaddress.ip_address(value)
    except ValueError:
        return False
    return (address.version == 4 and address.is_private
            and not address.is_multicast and not address.is_unspecified)


def _hostname(value):
    if not re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?", value):
        raise VestaboardError("Enter a private IPv4 address or a .local hostname.")
    return value


def resolve_host(value):
    """Resolve a configured board address and return a private IPv4 literal.

    Hostnames are resolved once per request and pinned to the returned address,
    so a later DNS change cannot redirect the proxy outside the LAN.
    """
    text = str(value or "").strip()
    if not text:
        raise VestaboardError("Set the Vestaboard address in StartOS → Actions & Config → Vestaboard Settings.")
    hostname, port = text, None
    if "://" in text:
        parsed = urllib.parse.urlsplit(text)
        if parsed.scheme not in ("http", "https") or parsed.path not in ("", "/"):
            raise VestaboardError("Enter only the Vestaboard address, not a URL path.")
        hostname, port = parsed.hostname, parsed.port
    elif re.fullmatch(r"[^:]+:\d+", text):
        hostname, port_text = text.rsplit(":", 1)
        port = int(port_text)
    if port not in (None, LOCAL_API_PORT):
        raise VestaboardError("The Vestaboard Local API uses port 7000.")
    hostname = _hostname(str(hostname or ""))
    if _is_private_ipv4(hostname):
        return hostname
    if not hostname.lower().endswith(".local") and not re.fullmatch(r"[A-Za-z0-9.-]+", hostname):
        raise VestaboardError("Enter a private IPv4 address or a .local hostname.")
    try:
        addresses = socket.getaddrinfo(hostname, LOCAL_API_PORT,
                                       family=socket.AF_INET,
                                       type=socket.SOCK_STREAM)
    except OSError as error:
        raise VestaboardError("Cannot resolve %s: %s" % (hostname, error))
    resolved = []
    for item in addresses:
        address = item[4][0]
        if not _is_private_ipv4(address):
            raise VestaboardError("%s resolves outside the private LAN; refusing to send." % hostname)
        if address not in resolved:
            resolved.append(address)
    if not resolved:
        raise VestaboardError("Cannot resolve %s to a private IPv4 address." % hostname)
    return resolved[0]


def _text_code(character):
    if character == " ":
        return 0
    upper = character.upper()
    if upper in LETTERS:
        return LETTERS[upper]
    if character in DIGITS:
        return DIGITS[character]
    if character in PUNCTUATION:
        return PUNCTUATION[character]
    if character in SPECIAL:
        return SPECIAL[character]
    raise VestaboardError("Vestaboard cannot display %r." % character)


def _expand_props(template, props):
    def replace(match):
        key = match.group(1)
        if key not in props:
            raise VestaboardError("VBML prop %r has no value." % key)
        return str(props[key])
    return re.sub(r"\{\{([A-Za-z0-9_]+)\}\}", replace, template)


def _parse_cells(text):
    """Cells are (code, is_literal_space); explicit newlines are markers."""
    cells, index = [], 0
    while index < len(text):
        character = text[index]
        if character == "{":
            match = re.match(r"\{(\d{1,2})\}", text[index:])
            if match:
                code = int(match.group(1))
                if not 0 <= code <= 71:
                    raise VestaboardError("VBML character code %d is outside 0–71." % code)
                cells.append((code, False))
                index += len(match.group(0))
                continue
        if character == "\n":
            cells.append(("newline", False))
            index += 1
            continue
        if character in "\r\ufe0f":
            index += 1
            continue
        if character == "\t":
            character = " "
        cells.append((_text_code(character), character == " "))
        index += 1
    return cells


def _hard_split(word, width):
    return [word[start:start + width] for start in range(0, len(word), width)]


def _wrap_cells(cells, width):
    """Word-wrap cells into lines; explicit newlines start a new line."""
    if width <= 0:
        raise VestaboardError("VBML width must be positive.")
    lines, line, word = [], [], []
    ended_with_newline = bool(cells and cells[-1][0] == "newline")

    def flush_word():
        if not word:
            return
        if not line:
            chunks = _hard_split(word, width)
            for chunk in chunks[:-1]:
                lines.append(chunk)
            line.extend(chunks[-1])
        elif len(line) + 1 + len(word) <= width:
            line.append(0)
            line.extend(word)
        else:
            lines.append(line[:])
            del line[:]
            chunks = _hard_split(word, width)
            for chunk in chunks[:-1]:
                lines.append(chunk)
            line.extend(chunks[-1])
        del word[:]

    for code, is_space in cells:
        if code == "newline":
            flush_word()
            lines.append(line[:])
            del line[:]
        elif is_space:
            flush_word()
        else:
            word.append(code)
    flush_word()
    if not ended_with_newline:
        lines.append(line[:])
    return lines


def _justify_line(line, width, mode, is_last):
    if not line:
        return []
    if len(line) > width:
        raise VestaboardError("A VBML line is wider than the board.")
    if mode == "left":
        return line[:]
    if mode == "right":
        return [0] * (width - len(line)) + line
    if mode == "center":
        return [0] * ((width - len(line)) // 2) + line
    if mode == "justified" and not is_last:
        spaces = sum(1 for cell in line if cell == 0)
        if spaces:
            extra = width - len(line)
            base, remainder = divmod(extra, spaces)
            out, seen = [], 0
            for cell in line:
                out.append(cell)
                if cell == 0:
                    out.extend([0] * (base + (1 if seen < remainder else 0)))
                    seen += 1
            return out
    return line[:]


def _vertical_offsets(count, height, mode):
    if count > height:
        raise VestaboardError("The VBML message needs %d rows but the board has %d." % (count, height))
    if mode == "top":
        return list(range(count))
    if mode == "bottom":
        start = height - count
        return [start + index for index in range(count)]
    if mode == "center":
        start = (height - count) // 2
        return [start + index for index in range(count)]
    if mode == "justified":
        if count <= 1:
            return [0]
        extra = height - count
        gaps = count - 1
        base, remainder = divmod(extra, gaps)
        offsets, offset = [], 0
        for index in range(count):
            offsets.append(offset)
            offset += 1 + base + (1 if index < remainder else 0)
        return offsets
    raise VestaboardError("Unknown VBML align mode %r." % mode)


def _component_matrix(component, props, rows, cols, cursor):
    style = component.get("style") or {}
    if not isinstance(style, dict):
        raise VestaboardError("VBML component style must be an object.")
    height = style.get("height", rows - cursor)
    width = style.get("width", cols)
    if not isinstance(height, int) or isinstance(height, bool) or not 1 <= height <= rows:
        raise VestaboardError("VBML component height must be between 1 and %d." % rows)
    if not isinstance(width, int) or isinstance(width, bool) or not 1 <= width <= cols:
        raise VestaboardError("VBML component width must be between 1 and %d." % cols)
    justify = style.get("justify", "left")
    align = style.get("align", "top")
    if justify not in ("left", "right", "center", "justified"):
        raise VestaboardError("Unknown VBML justify mode %r." % justify)
    if align not in ("top", "bottom", "center", "justified"):
        raise VestaboardError("Unknown VBML align mode %r." % align)

    raw = component.get("rawCharacters")
    template = component.get("template")
    if raw is not None:
        matrix = validate_matrix(raw, rows, cols) if _matrix_shape(raw) == (rows, cols) else validate_matrix(raw, height, width)
    elif template is not None:
        if not isinstance(template, str):
            raise VestaboardError("VBML template must be a string.")
        lines = _wrap_cells(_parse_cells(_expand_props(template, props)), width)
        offsets = _vertical_offsets(len(lines), height, align)
        matrix = [[0] * width for _ in range(height)]
        for index, line in enumerate(lines):
            cells = _justify_line(line, width, justify, index == len(lines) - 1)
            y = offsets[index]
            for x, code in enumerate(cells[:width]):
                matrix[y][x] = code
    else:
        raise VestaboardError("A VBML component needs a template or rawCharacters.")

    absolute = style.get("absolutePosition")
    if absolute is not None:
        if not isinstance(absolute, dict):
            raise VestaboardError("VBML absolutePosition must be an object.")
        x, y = absolute.get("x"), absolute.get("y")
        if (not isinstance(x, int) or isinstance(x, bool) or not isinstance(y, int)
                or isinstance(y, bool) or x < 0 or y < 0 or x + width > cols or y + height > rows):
            raise VestaboardError("VBML absolutePosition is outside the board.")
        return matrix, x, y, cursor
    if cursor + height > rows or cursor + len(matrix) > rows:
        raise VestaboardError("VBML components do not fit on the board.")
    return matrix, 0, cursor, cursor + height


def _matrix_shape(matrix):
    if not isinstance(matrix, list) or not matrix:
        return (0, 0)
    return (len(matrix), len(matrix[0]) if isinstance(matrix[0], list) else 0)


def validate_matrix(matrix, rows, cols):
    """Validate an exact board-sized matrix of character codes."""
    if not isinstance(matrix, list) or len(matrix) != rows:
        raise VestaboardError("Message must have exactly %d rows." % rows)
    out = []
    for row in matrix:
        if not isinstance(row, list) or len(row) != cols:
            raise VestaboardError("Every message row must have exactly %d columns." % cols)
        clean = []
        for value in row:
            if not isinstance(value, int) or isinstance(value, bool) or not 0 <= value <= 71:
                raise VestaboardError("Every cell must be an integer character code from 0 to 71.")
            clean.append(value)
        out.append(clean)
    return out


def compose_vbml(payload, rows, cols):
    """Compose a practical VBML subset into a board-sized character matrix.

    Supports props, templates, {n} character codes, multiple components,
    height/width, justify/align, absolutePosition and rawCharacters.
    """
    if not isinstance(payload, dict):
        raise VestaboardError("VBML payload must be an object.")
    style = payload.get("style") or {}
    if style:
        if not isinstance(style, dict):
            raise VestaboardError("VBML style must be an object.")
        if style.get("height") not in (None, rows) or style.get("width") not in (None, cols):
            raise VestaboardError("VBML style must match the configured %d×%d board." % (rows, cols))
    components = payload.get("components")
    if not isinstance(components, list) or not components:
        raise VestaboardError("VBML payload needs a non-empty components array.")
    if len(components) > MAX_COMPONENTS:
        raise VestaboardError("Too many VBML components.")
    props = payload.get("props") or {}
    if not isinstance(props, dict):
        raise VestaboardError("VBML props must be an object.")
    board = [[0] * cols for _ in range(rows)]
    cursor = 0
    for component in components:
        if not isinstance(component, dict):
            raise VestaboardError("Every VBML component must be an object.")
        matrix, x, y, cursor = _component_matrix(component, props, rows, cols, cursor)
        for row_index, row in enumerate(matrix):
            for col_index, code in enumerate(row):
                board[y + row_index][x + col_index] = code
    return board


def _local_request(config, method, payload=None):
    current = settings(config)
    if not current["host"] or not current["apiKey"]:
        raise VestaboardError("Set the Vestaboard address and Local API key in StartOS → Actions & Config → Vestaboard Settings.")
    address = resolve_host(current["host"])
    url = "http://%s:%d/local-api/message" % (address, LOCAL_API_PORT)
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    request = urllib.request.Request(url, data=body, method=method, headers={
        "Content-Type": "application/json",
        "X-Vestaboard-Local-Api-Key": current["apiKey"],
    })
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            raw = response.read(MAX_RESPONSE_BYTES)
    except urllib.error.HTTPError as error:
        detail = ""
        try:
            raw_error = error.read(4096).decode("utf-8", "replace").strip()
            try:
                parsed = json.loads(raw_error)
                detail = str(parsed.get("message") or parsed.get("error") or raw_error)
            except (TypeError, ValueError):
                detail = raw_error
        except OSError:
            detail = ""
        raise VestaboardError("Vestaboard rejected the request (HTTP %d)%s" % (
            error.code, ": " + detail if detail else ""), error.code)
    except (urllib.error.URLError, socket.timeout, TimeoutError) as error:
        raise VestaboardError("Cannot reach Vestaboard at %s:%d (%s)." % (
            current["host"], LOCAL_API_PORT, getattr(error, "reason", error)))
    if not raw.strip():
        return {}
    try:
        return json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        raise VestaboardError("Vestaboard returned an invalid response.")


def read_message(config):
    """Read and validate the board's current message."""
    current = settings(config)
    document = _local_request(config, "GET")
    if isinstance(document, list):
        matrix = document
    elif isinstance(document, dict):
        matrix = document.get("characters", document.get("message"))
    else:
        matrix = None
    if not isinstance(matrix, list):
        raise VestaboardError("Vestaboard did not return a message array.")
    return validate_matrix(matrix, current["rows"], current["cols"])


def send_message(config, characters):
    """Validate and send a board-sized message to the Local API."""
    current = settings(config)
    matrix = validate_matrix(characters, current["rows"], current["cols"])
    _local_request(config, "POST", {"characters": matrix})
    return matrix


def send_vbml(config, payload):
    """Compose VBML locally, then send the resulting character matrix."""
    current = settings(config)
    matrix = compose_vbml(payload, current["rows"], current["cols"])
    _local_request(config, "POST", {"characters": matrix})
    return matrix
