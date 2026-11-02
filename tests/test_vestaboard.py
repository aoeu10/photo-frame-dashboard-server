import io
import json
import unittest
import urllib.error
from unittest import mock

from service import vestaboard


def config(**overrides):
    board = {"host": "192.168.1.50", "apiKey": "secret-key", "board": "flagship"}
    board.update(overrides)
    return {"vestaboard": board}


class VestaboardSettingsTests(unittest.TestCase):
    def test_public_settings_never_expose_the_key(self):
        public = vestaboard.public_settings(config())
        self.assertTrue(public["configured"])
        self.assertNotIn("apiKey", public)
        self.assertTrue(public["apiKeyConfigured"])
        self.assertEqual((public["rows"], public["cols"]), (6, 22))

    def test_note_preset_and_unconfigured_state(self):
        public = vestaboard.public_settings(config(board="note", apiKey=""))
        self.assertFalse(public["configured"])
        self.assertEqual(public["board"], "note")
        self.assertEqual((public["rows"], public["cols"]), (3, 15))

    def test_unknown_board_falls_back_to_flagship(self):
        public = vestaboard.public_settings(config(board="huge"))
        self.assertEqual(public["board"], "flagship")
        self.assertEqual((public["rows"], public["cols"]), (6, 22))


class HostResolutionTests(unittest.TestCase):
    def test_private_ipv4_and_url_are_accepted(self):
        self.assertEqual(vestaboard.resolve_host("192.168.1.50"), "192.168.1.50")
        self.assertEqual(
            vestaboard.resolve_host("http://192.168.1.50:7000/"),
            "192.168.1.50",
        )

    def test_public_or_nonstandard_addresses_are_rejected(self):
        for value in ("8.8.8.8", "192.168.1.50:7001", "http://192.168.1.50:7001"):
            with self.assertRaises(vestaboard.VestaboardError):
                vestaboard.resolve_host(value)

    @mock.patch("service.vestaboard.socket.getaddrinfo")
    def test_local_hostname_must_resolve_inside_the_lan(self, getaddrinfo):
        getaddrinfo.return_value = [(None, None, None, "", ("192.168.1.77", 7000))]
        self.assertEqual(vestaboard.resolve_host("vestaboard.local"), "192.168.1.77")
        getaddrinfo.return_value = [(None, None, None, "", ("8.8.8.8", 7000))]
        with self.assertRaises(vestaboard.VestaboardError):
            vestaboard.resolve_host("vestaboard.local")

    @mock.patch("service.vestaboard.socket.getaddrinfo", side_effect=OSError("no such host"))
    def test_unresolvable_hostname_reports_an_error(self, _getaddrinfo):
        with self.assertRaises(vestaboard.VestaboardError):
            vestaboard.resolve_host("missing.local")


class VbmlCompositionTests(unittest.TestCase):
    def test_plain_text_uses_vestaboard_character_codes(self):
        matrix = vestaboard.compose_vbml(
            {"components": [{"template": "HELLO\nWORLD"}]}, 6, 22
        )
        self.assertEqual(matrix[0][:5], [8, 5, 12, 12, 15])
        self.assertEqual(matrix[1][:5], [23, 15, 18, 12, 4])
        self.assertEqual(matrix[2], [0] * 22)

    def test_trailing_newline_does_not_add_a_row(self):
        matrix = vestaboard.compose_vbml(
            {"components": [{"template": "HELLO\n"}]}, 6, 22
        )
        self.assertEqual(matrix[0][:5], [8, 5, 12, 12, 15])
        self.assertEqual(matrix[1], [0] * 22)

    def test_props_character_codes_and_lowercase(self):
        matrix = vestaboard.compose_vbml({
            "props": {"name": "Ada"},
            "components": [{"template": "Hi {{name}} {63}"}],
        }, 6, 22)
        self.assertEqual(matrix[0][:8], [8, 9, 0, 1, 4, 1, 0, 63])

    def test_note_centering_and_heart(self):
        matrix = vestaboard.compose_vbml({
            "style": {"height": 3, "width": 15},
            "components": [{
                "template": "I❤️U",
                "style": {"justify": "center", "align": "center"},
            }],
        }, 3, 15)
        self.assertEqual(matrix[1], [0, 0, 0, 0, 0, 0, 9, 62, 21, 0, 0, 0, 0, 0, 0])

    def test_multiple_components_and_absolute_position(self):
        matrix = vestaboard.compose_vbml({
            "components": [
                {"template": "TOP", "style": {"height": 2}},
                {"template": "BOTTOM", "style": {"height": 2}},
                {"template": "X", "style": {
                    "height": 1, "width": 1, "absolutePosition": {"x": 21, "y": 5},
                }},
            ],
        }, 6, 22)
        self.assertEqual(matrix[0][:3], [20, 15, 16])
        self.assertEqual(matrix[2][:6], [2, 15, 20, 20, 15, 13])
        self.assertEqual(matrix[5][21], 24)

    def test_justified_text_fills_the_width(self):
        matrix = vestaboard.compose_vbml({
            "components": [{
                "template": "A B\nC D",
                "style": {"justify": "justified", "height": 2},
            }],
        }, 6, 22)
        self.assertEqual(len(matrix[0]), 22)
        self.assertEqual(matrix[0][0], 1)
        self.assertEqual(matrix[0][-1], 2)
        self.assertGreater(matrix[0].count(0), 1)
        self.assertEqual(matrix[1][:3], [3, 0, 4])

    def test_raw_characters_can_fill_the_board(self):
        raw = [[0] * 22 for _ in range(6)]
        raw[2][4] = 63
        matrix = vestaboard.compose_vbml({
            "components": [{"rawCharacters": raw}],
        }, 6, 22)
        self.assertEqual(matrix[2][4], 63)

    def test_invalid_vbml_is_rejected(self):
        cases = [
            {},
            {"components": []},
            {"components": [{"template": "A", "style": {"height": 7}}]},
            {"components": [{"template": "A", "style": {"absolutePosition": {"x": 22, "y": 0}}}]},
            {"components": [{"template": "☃"}]},
            {"style": {"height": 3, "width": 15}, "components": [{"template": "A"}]},
        ]
        for payload in cases:
            with self.assertRaises(vestaboard.VestaboardError):
                vestaboard.compose_vbml(payload, 6, 22)


class MatrixValidationTests(unittest.TestCase):
    def test_exact_shape_and_range_are_required(self):
        valid = [[0] * 22 for _ in range(6)]
        self.assertEqual(vestaboard.validate_matrix(valid, 6, 22), valid)
        for matrix in (
            [[0] * 22 for _ in range(5)],
            [[0] * 21 for _ in range(6)],
            [[0] * 21 + [72] for _ in range(6)],
            [[0] * 21 + [True] for _ in range(6)],
            [[0] * 21 + ["8"] for _ in range(6)],
        ):
            with self.assertRaises(vestaboard.VestaboardError):
                vestaboard.validate_matrix(matrix, 6, 22)


class LocalApiTests(unittest.TestCase):
    class Response:
        def __init__(self, body):
            self.body = body

        def read(self, _limit):
            return self.body

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

    def test_read_uses_the_key_header_and_validates_the_result(self):
        matrix = [[0] * 22 for _ in range(6)]
        matrix[0][0] = 8
        calls = []

        def urlopen(request, timeout):
            calls.append(request)
            return self.Response(json.dumps(matrix).encode())

        with mock.patch("service.vestaboard.urllib.request.urlopen", urlopen):
            result = vestaboard.read_message(config())
        self.assertEqual(result, matrix)
        request = calls[0]
        self.assertEqual(request.full_url, "http://192.168.1.50:7000/local-api/message")
        self.assertEqual(request.get_method(), "GET")
        self.assertEqual(request.headers["X-vestaboard-local-api-key"], "secret-key")

    def test_send_posts_the_character_matrix(self):
        matrix = [[0] * 22 for _ in range(6)]
        matrix[0][0] = 8
        calls = []

        def urlopen(request, timeout):
            calls.append(request)
            return self.Response(b"{}")

        with mock.patch("service.vestaboard.urllib.request.urlopen", urlopen):
            result = vestaboard.send_message(config(), matrix)
        self.assertEqual(result, matrix)
        request = calls[0]
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(json.loads(request.data), {"characters": matrix})
        self.assertEqual(request.headers["X-vestaboard-local-api-key"], "secret-key")

    def test_board_http_error_is_reported_without_the_key(self):
        error = urllib.error.HTTPError(
            "http://192.168.1.50:7000/local-api/message", 401, "Unauthorized",
            {}, io.BytesIO(b'{"message":"invalid key"}'),
        )
        with mock.patch("service.vestaboard.urllib.request.urlopen", side_effect=error):
            with self.assertRaises(vestaboard.VestaboardError) as raised:
                vestaboard.read_message(config())
        self.assertEqual(raised.exception.status, 401)
        self.assertIn("invalid key", str(raised.exception))
        self.assertNotIn("secret-key", str(raised.exception))

    def test_unconfigured_or_unreachable_board_is_reported(self):
        with self.assertRaises(vestaboard.VestaboardError):
            vestaboard.read_message(config(apiKey=""))
        with mock.patch(
            "service.vestaboard.urllib.request.urlopen",
            side_effect=urllib.error.URLError("connection refused"),
        ):
            with self.assertRaises(vestaboard.VestaboardError) as raised:
                vestaboard.read_message(config())
        self.assertIn("Cannot reach Vestaboard", str(raised.exception))

    def test_empty_successful_response_is_accepted(self):
        with mock.patch(
            "service.vestaboard.urllib.request.urlopen",
            return_value=self.Response(b""),
        ):
            matrix = vestaboard.send_message(config(), [[0] * 22 for _ in range(6)])
        self.assertEqual(matrix, [[0] * 22 for _ in range(6)])


if __name__ == "__main__":
    unittest.main()
