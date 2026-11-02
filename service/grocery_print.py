"""Grocery-list PDFs, Bonjour/subnet printer discovery and IPP printing.

Discovery queries IPP attributes without printing. Subnet probing is restricted
to bounded private IPv4 networks; printing talks IPP directly without CUPS.
IPPS uses an unverified TLS context for LAN printers with self-signed certs.
"""
import datetime
import concurrent.futures
import http.client
import ipaddress
import re
import socket
import ssl
import struct
import textwrap
import threading
import time
import urllib.parse
import urllib.request

PAGE_W, PAGE_H = 612, 792
MARGIN = 54
COLUMN_GUTTER = 18
MAX_COLUMNS = 3
PRINT_TIMEOUT = 30
SCAN_HOST_LIMIT = 1024
SCAN_SECONDS = 25
SCAN_WORKERS = 48
CONNECT_TIMEOUT = 0.3
QUERY_TIMEOUT = 2
PRINTER_PORTS = (("ipp", 631), ("ipps", 443), ("ipps", 631))
PRINTER_PATHS = ("/ipp/print", "/ipp/printer", "/printers", "/")
PRIVATE_NETWORKS = tuple(ipaddress.ip_network(cidr) for cidr in (
    "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"))

_discovery_lock = threading.Lock()
_discovery_cache = {"at": 0.0, "printers": []}


def _latin(value):
    return str(value).encode("latin-1", "replace").decode("latin-1")


def _pdf_escape(value):
    return _latin(value).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _text(x, y_top, size, bold, gray, value):
    color = "0.42 0.42 0.42" if gray else "0.08 0.08 0.08"
    font = "F2" if bold else "F1"
    return "BT /%s %d Tf %s rg %.2f %.2f Td (%s) Tj ET" % (
        font, size, color, x, PAGE_H - y_top, _pdf_escape(value))


def _line(x1, y1, x2, y2, width=0.7):
    return "0.1 0.1 0.1 RG %.2f w %.2f %.2f m %.2f %.2f l S" % (
        width, x1, PAGE_H - y1, x2, PAGE_H - y2)


def _rect(x, y_top, width, height, gray=False):
    color = "0.55 0.55 0.55" if gray else "0.1 0.1 0.1"
    return "%s RG 0.8 w %.2f %.2f %.2f %.2f re S" % (
        color, x, PAGE_H - y_top - height, width, height)


def build_groceries_pdf(shopping, zone=None):
    """A printable grocery list with store columns and inline quantities."""
    entries = [e for e in shopping.get("list", []) if not e.get("done")]
    stores = shopping.get("stores") or []
    categories = shopping.get("categories") or ["Other"]
    if "Other" not in categories:
        categories = categories + ["Other"]

    groups = {}
    for entry in entries:
        store = entry.get("store") or ""
        groups.setdefault(store, []).append(entry)
    # Preserve configured store order; append unexpected stores, then blank.
    order = [s for s in stores if s in groups]
    order += [s for s in groups if s not in order and s]
    if "" in groups:
        order.append("")

    pages = [[]]
    page_index = 0
    y = MARGIN

    now = datetime.datetime.now(zone) if zone else datetime.datetime.now()
    date_text = "%s, %s %d, %d" % (now.strftime("%A"), now.strftime("%B"), now.day, now.year)

    def add(content):
        pages[page_index].append(content)

    def new_page(continued=False):
        nonlocal page_index, y
        pages.append([])
        page_index += 1
        y = MARGIN
        if continued:
            add(_text(MARGIN, y + 12, 16, True, False, "GROCERIES · CONTINUED"))
            add(_line(MARGIN, y + 18, PAGE_W - MARGIN, y + 18, 1.2))
            y += 30

    def header():
        nonlocal y
        add(_text(MARGIN, y + 12, 30, True, False, "GROCERIES"))
        add(_text(PAGE_W - MARGIN - 210, y + 12, 10, False, True, date_text))
        add(_line(MARGIN, y + 22, PAGE_W - MARGIN, y + 22, 1.5))
        add(_text(MARGIN, y + 38, 10, False, True, "%d item%s on the shared list" % (
            len(entries), "" if len(entries) == 1 else "s")))
        y += 52

    header()

    if not entries:
        add(_text(MARGIN, y + 18, 14, False, True, "No items on the list."))
    else:
        block_count = sum(1 for store in order if groups.get(store))
        col_count = min(MAX_COLUMNS, block_count) or 1
        col_width = (PAGE_W - 2 * MARGIN - COLUMN_GUTTER * (col_count - 1)) / col_count
        item_chars = max(12, int((col_width - 17) / 6.2))
        note_chars = max(16, int((col_width - 17) / 4.6))
        store_chars = max(10, int(col_width / 8.0))

        blocks = []
        for store in order:
            items = groups.get(store, [])
            if not items:
                continue
            segments = []
            if len(order) > 1:
                label = store or "Unspecified"
                segments.append(("store", textwrap.wrap(label, store_chars) or [label]))
            for category in categories:
                cat_items = [e for e in items if e.get("category") == category]
                if not cat_items:
                    continue
                segments.append(("category", textwrap.wrap(category.upper(), item_chars) or [category.upper()]))
                for entry in cat_items:
                    name = entry.get("name") or "Item"
                    qty = entry.get("qty") or 1
                    lines = textwrap.wrap("%s  x%d" % (name, qty), item_chars) or [name]
                    note = entry.get("note") or ""
                    note_lines = textwrap.wrap(note, note_chars) if note else []
                    segments.append(("item", lines, note_lines))
            segments.append(("space",))
            blocks.append(segments)

        def segment_height(segment):
            kind = segment[0]
            if kind == "store":
                return 14 + 14 * (len(segment[1]) - 1) + 10
            if kind == "category":
                return 14 + 14 * (len(segment[1]) - 1) + 10
            if kind == "item":
                lines, note_lines = segment[1], segment[2]
                return 16 + 14 * (len(lines) - 1) + 13 * len(note_lines) + 4
            return 8

        def draw_segment(segment, x, start_y):
            kind = segment[0]
            if kind == "store":
                cursor = start_y
                for line in segment[1]:
                    add(_text(x, cursor + 14, 15, True, False, line))
                    cursor += 14
                return cursor - start_y + 10
            if kind == "category":
                cursor = start_y
                for line in segment[1]:
                    add(_text(x, cursor + 12, 11, True, False, line))
                    cursor += 14
                add(_line(x, cursor + 2, x + col_width, cursor + 2, 0.7))
                return cursor - start_y + 10
            if kind == "item":
                lines, note_lines = segment[1], segment[2]
                add(_rect(x, start_y + 1, 9, 9))
                add(_text(x + 17, start_y + 10, 12, False, False, lines[0]))
                cursor = start_y + 16
                for extra in lines[1:]:
                    add(_text(x + 17, cursor + 9, 12, False, False, extra))
                    cursor += 14
                for note_line in note_lines:
                    add(_text(x + 17, cursor + 9, 9, False, True, note_line))
                    cursor += 13
                return cursor - start_y + 4
            return 8

        rows = [blocks[i:i + col_count] for i in range(0, len(blocks), col_count)]
        bottom = PAGE_H - MARGIN - 18
        for row_index, row in enumerate(rows):
            cursors = [[0, y] for _ in row]
            while True:
                pending = [i for i, cursor in enumerate(cursors) if cursor[0] < len(row[i])]
                if not pending:
                    break
                if any(cursors[i][1] + segment_height(row[i][cursors[i][0]]) > bottom
                       for i in pending):
                    new_page(True)
                    for i, cursor in enumerate(cursors):
                        cursor[1] = y
                        # A store label already drawn on the prior page is
                        # repeated at the top of the continuation page so the
                        # column keeps its attribution without duplicating it
                        # later in the column.
                        if cursor[0] > 0 and cursor[0] < len(row[i]) and row[i][0][0] == "store":
                            x = MARGIN + i * (col_width + COLUMN_GUTTER)
                            cursor[1] += draw_segment(row[i][0], x, cursor[1])
                for i in pending:
                    segment = row[i][cursors[i][0]]
                    x = MARGIN + i * (col_width + COLUMN_GUTTER)
                    cursors[i][1] += draw_segment(segment, x, cursors[i][1])
                    cursors[i][0] += 1
            y = max(cursor[1] for cursor in cursors) + 8
            if row_index < len(rows) - 1 and y > PAGE_H - MARGIN - 60:
                new_page(True)

    total = len(pages)
    for number, content in enumerate(pages, 1):
        content.append(_line(MARGIN, PAGE_H - MARGIN + 18, PAGE_W - MARGIN, PAGE_H - MARGIN + 18, 0.5))
        content.append(_text(PAGE_W - MARGIN - 62, PAGE_H - MARGIN + 28, 9, False, True,
                             "Page %d of %d" % (number, total)))
    return _build_pdf(pages)


def _build_pdf(pages):
    objects = [None, None, None, None]
    objects[2] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
    page_ids = []
    for content in pages:
        stream = "\n".join(content).encode("latin-1")
        objects.append("<< /Length %d >>\nstream\n" % len(stream) + stream.decode("latin-1") +
                       "\nendstream")
        content_id = len(objects)
        objects.append(
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] "
            "/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents %d 0 R >>" % (
                PAGE_W, PAGE_H, content_id))
        page_ids.append(len(objects))
    objects[1] = "<< /Type /Pages /Kids [%s] /Count %d >>" % (
        " ".join("%d 0 R" % pid for pid in page_ids), len(page_ids))
    objects[0] = "<< /Type /Catalog /Pages 2 0 R >>"

    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0] * (len(objects) + 1)
    for index, obj in enumerate(objects, 1):
        offsets[index] = len(out)
        out += ("%d 0 obj\n" % index).encode("latin-1") + obj.encode("latin-1") + b"\nendobj\n"
    xref = len(out)
    out += ("xref\n0 %d\n" % (len(objects) + 1)).encode("latin-1")
    out += b"0000000000 65535 f \n"
    for offset in offsets[1:]:
        out += ("%010d 00000 n \n" % offset).encode("latin-1")
    out += ("trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (
        len(objects) + 1, xref)).encode("latin-1")
    return bytes(out)


def _ipp_attr(tag, name, value):
    name_b = name.encode("ascii")
    value_b = value.encode("utf-8")
    return bytes([tag]) + struct.pack(">H", len(name_b)) + name_b + \
        struct.pack(">H", len(value_b)) + value_b


def _ipp_request(printer_uri, pdf, job_name):
    attrs = b"\x01"  # operation-attributes-tag
    attrs += _ipp_attr(0x47, "attributes-charset", "utf-8")
    attrs += _ipp_attr(0x48, "attributes-natural-language", "en")
    attrs += _ipp_attr(0x45, "printer-uri", printer_uri)
    attrs += _ipp_attr(0x42, "requesting-user-name", "Frame Dashboard")
    attrs += _ipp_attr(0x42, "job-name", job_name)
    attrs += _ipp_attr(0x49, "document-format", "application/pdf")
    return b"\x02\x00" + struct.pack(">H", 2) + struct.pack(">I", 1) + attrs + b"\x03" + pdf


def _ipp_response(response):
    if len(response) < 8:
        raise RuntimeError("printer returned an incomplete IPP response")
    status = struct.unpack(">H", response[2:4])[0]
    if status != 0:
        message = None
        pos = 8
        while pos < len(response):
            tag = response[pos]
            pos += 1
            if tag == 0x03:
                break
            if tag < 0x10:
                continue
            if pos + 2 > len(response):
                break
            name_len = struct.unpack(">H", response[pos:pos + 2])[0]
            pos += 2
            name = response[pos:pos + name_len]
            pos += name_len
            if pos + 2 > len(response):
                break
            value_len = struct.unpack(">H", response[pos:pos + 2])[0]
            pos += 2
            value = response[pos:pos + value_len]
            pos += value_len
            if name == b"status-message":
                message = value.decode("utf-8", "replace")
        raise RuntimeError(message or "printer returned status 0x%04x" % status)
    job_id = None
    pos = 8
    while pos < len(response):
        tag = response[pos]
        pos += 1
        if tag == 0x03:
            break
        if tag < 0x10:
            continue
        if pos + 2 > len(response):
            break
        name_len = struct.unpack(">H", response[pos:pos + 2])[0]
        pos += 2
        name = response[pos:pos + name_len]
        pos += name_len
        if pos + 2 > len(response):
            break
        value_len = struct.unpack(">H", response[pos:pos + 2])[0]
        pos += 2
        value = response[pos:pos + value_len]
        pos += value_len
        if name == b"job-id" and len(value) == 4:
            job_id = struct.unpack(">I", value)[0]
    return job_id


def print_pdf(printer_url, pdf, job_name="Groceries"):
    parts = urllib.parse.urlsplit(printer_url)
    if parts.scheme not in ("ipp", "ipps") or not parts.hostname:
        raise ValueError("Use an ipp:// or ipps:// printer URL")
    http_scheme = "https" if parts.scheme == "ipps" else "http"
    path = parts.path or "/ipp/print"
    http_url = urllib.parse.urlunsplit((http_scheme, parts.netloc, path, parts.query, ""))
    context = ssl._create_unverified_context() if parts.scheme == "ipps" else None
    request = urllib.request.Request(
        http_url,
        data=_ipp_request(printer_url, pdf, job_name),
        headers={"Content-Type": "application/ipp"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=PRINT_TIMEOUT, context=context) as response:
        return _ipp_response(response.read())


def _service_url(info, scheme):
    props = info.properties or {}
    path = (props.get(b"rp") or b"/ipp/print").decode("utf-8", "replace")
    if not path.startswith("/"):
        path = "/" + path
    addresses = info.parsed_addresses()
    host = None
    for address in addresses:
        try:
            parsed = ipaddress.ip_address(address)
        except ValueError:
            continue
        if parsed.version == 4:
            host = address
            break
    if not host and addresses:
        host = addresses[0]
    if not host:
        host = info.server
    if ":" in host:
        host = "[" + host + "]"
    port = info.port or 631
    return "%s://%s:%d%s" % (scheme, host, port, path)


def _display_name(info, scheme):
    name = re.sub(r"\._(?:ipp|ipps)\._tcp\.local\.?$", "", info.name or "")
    props = info.properties or {}
    model = (props.get(b"ty") or b"").decode("utf-8", "replace")
    return (model or name or "Printer").strip()


def _bonjour_printers(timeout):
    """Collect advertised endpoints; IPP capability is verified separately."""
    try:
        from zeroconf import ServiceBrowser, Zeroconf
    except ImportError as e:
        raise RuntimeError("Printer discovery dependency could not load: %s" % e) from e
    found = {}
    try:
        zc = Zeroconf()
    except Exception as e:
        raise RuntimeError("Could not start Bonjour discovery: %s" % e) from e
    try:
        class Listener:
            def add_service(self, zeroconf, service_type, name):
                info = zeroconf.get_service_info(service_type, name, timeout=1500)
                if not info:
                    return
                scheme = "ipps" if "_ipps._tcp" in service_type else "ipp"
                url = _service_url(info, scheme)
                props = info.properties or {}
                found[url] = {
                    "name": _display_name(info, scheme),
                    "url": url,
                    "model": (props.get(b"ty") or b"").decode("utf-8", "replace"),
                    "note": (props.get(b"note") or b"").decode("utf-8", "replace"),
                    "formats": (props.get(b"pdl") or b"").decode("utf-8", "replace"),
                }

            def update_service(self, zeroconf, service_type, name):
                self.add_service(zeroconf, service_type, name)

            def remove_service(self, zeroconf, service_type, name):
                pass

        listener = Listener()
        ServiceBrowser(zc, "_ipp._tcp.local.", listener)
        ServiceBrowser(zc, "_ipps._tcp.local.", listener)
        time.sleep(timeout)
    finally:
        try:
            zc.close()
        except Exception:
            pass
    return sorted(found.values(), key=lambda p: (p["name"].lower(), p["url"]))


def _private_subnet(value):
    network = ipaddress.ip_network(value, strict=False)
    if network.version != 4 or not any(network.subnet_of(lan) for lan in PRIVATE_NETWORKS):
        raise ValueError("Printer scans require a private IPv4 subnet, such as 192.168.1.0/24.")
    if network.num_addresses > SCAN_HOST_LIMIT:
        raise ValueError("Printer scans allow at most 1024 addresses. Set Scan subnet in Printer Settings to a smaller range, such as 192.168.1.0/24.")
    return network


def _local_subnets(route_path="/proc/net/route"):
    """Read Linux's directly connected, up, private IPv4 routes (not defaults)."""
    networks = set()
    with open(route_path, encoding="ascii") as routes:
        next(routes, None)
        for line in routes:
            fields = line.split()
            if len(fields) < 8 or fields[0] == "lo":
                continue
            if not int(fields[3], 16) & 1 or int(fields[2], 16) or not int(fields[7], 16):
                continue
            address = socket.inet_ntoa(bytes.fromhex(fields[1])[::-1])
            mask = socket.inet_ntoa(bytes.fromhex(fields[7])[::-1])
            try:
                networks.add(_private_subnet(address + "/" + mask))
            except ValueError:
                # Ignore public, VPN-wide or oversized routes, never truncate one.
                continue
    if not networks:
        raise ValueError("No bounded local IPv4 subnet detected. Set Scan subnet in StartOS Printer Settings to your LAN, such as 192.168.1.0/24.")
    return sorted(networks, key=lambda network: (int(network.network_address), network.prefixlen))


def _printer_attributes(response):
    """Decode only a complete successful IPP printer-attributes response."""
    if len(response) < 9 or response[0] not in (1, 2):
        return None
    if struct.unpack(">H", response[2:4])[0] > 0x00ff or response[4:8] != b"\x00\x00\x00\x01":
        return None
    attributes = {}
    group, name, pos = None, None, 8
    while pos < len(response):
        tag = response[pos]
        pos += 1
        if tag == 3:
            return attributes
        if tag < 0x10:
            if tag not in (1, 2, 4, 5):
                return None
            group, name = tag, None
            continue
        if pos + 2 > len(response):
            return None
        size = struct.unpack_from(">H", response, pos)[0]
        pos += 2
        if pos + size + 2 > len(response):
            return None
        if size:
            name = response[pos:pos + size].decode("ascii", "replace")
        elif name is None:
            return None
        pos += size
        size = struct.unpack_from(">H", response, pos)[0]
        pos += 2
        if pos + size > len(response):
            return None
        if group == 4:
            attributes.setdefault(name, []).append((tag, response[pos:pos + size]))
        pos += size
    return None


def _query_printer(uri, deadline):
    """Get-Printer-Attributes is read-only: never submits a print job."""
    remaining = min(QUERY_TIMEOUT, deadline - time.monotonic())
    if remaining <= 0:
        return None
    try:
        parts = urllib.parse.urlsplit(uri)
        port = parts.port or 631
        # Numeric addresses avoid unbounded system DNS lookups during a scan.
        ipaddress.ip_address(parts.hostname or "")
        if parts.scheme not in ("ipp", "ipps") or not parts.hostname:
            return None
    except ValueError:
        return None
    attrs = b"\x01" + _ipp_attr(0x47, "attributes-charset", "utf-8")
    attrs += _ipp_attr(0x48, "attributes-natural-language", "en")
    attrs += _ipp_attr(0x45, "printer-uri", uri)
    # Request only simple attributes, not collections or potentially large media databases.
    attrs += _ipp_attr(0x44, "requested-attributes", "printer-name")
    for name in ("printer-make-and-model", "printer-state", "operations-supported",
                 "document-format-supported", "printer-uuid"):
        attrs += _ipp_attr(0x44, "", name)
    request = b"\x01\x01\x00\x0b\x00\x00\x00\x01" + attrs + b"\x03"
    if parts.scheme == "ipps":
        connection = http.client.HTTPSConnection(parts.hostname, port, timeout=remaining,
                                                 context=ssl._create_unverified_context())
    else:
        connection = http.client.HTTPConnection(parts.hostname, port, timeout=remaining)
    timer = None
    try:
        connection.connect()
        sock = connection.sock

        def abort():
            try:
                sock.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass

        # A total query deadline also bounds peers that drip-feed HTTP headers/body.
        timer = threading.Timer(max(0.001, min(remaining, deadline - time.monotonic())), abort)
        timer.daemon = True
        timer.start()
        path = parts.path or "/ipp/print"
        if parts.query:
            path += "?" + parts.query
        connection.request("POST", path, request, {"Content-Type": "application/ipp"})
        response = connection.getresponse()
        if response.status != 200 or response.getheader("Content-Type", "").split(";")[0].strip().lower() != "application/ipp":
            return None
        body = response.read(65537)
        if len(body) > 65536:
            return None
        attributes = _printer_attributes(body)
        if attributes is None:
            return None
        states = [int.from_bytes(value, "big") for tag, value in attributes.get("printer-state", [])
                  if tag == 0x23 and len(value) == 4]
        operations = [int.from_bytes(value, "big") for tag, value in attributes.get("operations-supported", [])
                      if tag == 0x23 and len(value) == 4]
        formats = [value.decode("utf-8", "replace") for tag, value in attributes.get("document-format-supported", [])
                   if tag == 0x49]
        if not any(state in (3, 4, 5) for state in states) or 2 not in operations or "application/pdf" not in formats:
            return None

        def text(name):
            return next((value.decode("utf-8", "replace") for tag, value in attributes.get(name, [])
                         if tag in (0x41, 0x42, 0x45)), "")

        model = text("printer-make-and-model")
        return {"name": text("printer-name") or model or parts.hostname, "url": uri,
                "model": model, "formats": ",".join(formats), "uuid": text("printer-uuid")}
    except (OSError, ValueError, http.client.HTTPException):
        return None
    finally:
        if timer is not None:
            timer.cancel()
        connection.close()


def _probe_host(host, deadline):
    for scheme, port in PRINTER_PORTS:
        remaining = min(CONNECT_TIMEOUT, deadline - time.monotonic())
        if remaining <= 0:
            return None
        try:
            with socket.create_connection((host, port), remaining):
                pass
        except OSError:
            continue
        for path in PRINTER_PATHS:
            printer = _query_printer("%s://%s:%d%s" % (scheme, host, port, path), deadline)
            if printer:
                return printer
    return None


def discover_printers(timeout=3, force=False, subnets=None):
    """Combine Bonjour with bounded private-subnet probes; verify PDF/Print-Job."""
    scope = tuple(subnets) if subnets else None
    with _discovery_lock:
        if not force and _discovery_cache.get("scope") == scope and time.time() - _discovery_cache["at"] < 30:
            return list(_discovery_cache["printers"])
    networks = [_private_subnet(value) for value in subnets] if subnets else None
    scan_error = None
    if networks is None:
        try:
            networks = _local_subnets()
        except (OSError, ValueError) as error:
            networks, scan_error = [], str(error)
    hosts = {str(host) for network in networks for host in network.hosts()}
    if len(hosts) > SCAN_HOST_LIMIT:
        raise ValueError("Combined printer scan exceeds 1024 hosts. Set a smaller Scan subnet in Printer Settings.")
    try:
        advertised = _bonjour_printers(timeout)
    except RuntimeError as error:
        advertised = []
        if not hosts:
            raise RuntimeError("%s %s" % (error, scan_error or "")) from error
    if not hosts and not advertised:
        raise RuntimeError(scan_error or "No local network available for printer discovery.")
    deadline = time.monotonic() + SCAN_SECONDS
    found = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=SCAN_WORKERS) as pool:
        tasks = [pool.submit(_probe_host, host, deadline) for host in sorted(hosts, key=ipaddress.ip_address)]
        tasks += [pool.submit(_query_printer, printer["url"], deadline) for printer in advertised]
        for task in concurrent.futures.as_completed(tasks):
            printer = task.result()
            if printer:
                # A UUID deduplicates IPP/IPPS advertisements of the same printer.
                key = printer.get("uuid") or printer["url"]
                previous = found.get(key)
                if previous is None or printer["url"] < previous["url"]:
                    found[key] = printer
    if not found and time.monotonic() >= deadline:
        raise RuntimeError("Printer scan reached its time limit. Set a smaller Scan subnet in Printer Settings and search again.")
    printers = sorted(found.values(), key=lambda printer: (printer["name"].lower(), printer["url"]))
    with _discovery_lock:
        _discovery_cache.update(at=time.time(), printers=printers, scope=scope)
    return printers
