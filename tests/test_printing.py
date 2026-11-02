import json
import os
import re
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

from service import grocery_print
from service import dashboard_service


class PrintTests(unittest.TestCase):
    def test_grocery_pdf_is_grouped_and_readable(self):
        pdf = grocery_print.build_groceries_pdf({
            "stores": ["Sam's", "Costco"],
            "categories": ["Produce", "Pantry", "Other"],
            "items": [],
            "list": [
                {"name": "Apples", "category": "Produce", "store": "Sam's", "qty": 2, "note": "Honeycrisp", "done": False},
                {"name": "Rice", "category": "Pantry", "store": "Costco", "qty": 1, "note": "", "done": False},
                {"name": "Old item", "category": "Other", "store": "", "qty": 1, "note": "", "done": True},
            ],
        })
        self.assertTrue(pdf.startswith(b"%PDF-1.4"))
        self.assertIn(b"GROCERIES", pdf)
        self.assertIn(b"Sam's", pdf)
        self.assertIn(b"Costco", pdf)
        self.assertIn(b"Apples", pdf)
        self.assertIn(b"Honeycrisp", pdf)
        self.assertNotIn(b"Old item", pdf)

    def test_grocery_pdf_uses_store_columns_and_inline_quantities(self):
        pdf = grocery_print.build_groceries_pdf({
            "stores": ["Sam's", "Costco"],
            "categories": ["Produce", "Pantry", "Other"],
            "items": [],
            "list": [
                {"name": "Apples", "category": "Produce", "store": "Sam's", "qty": 2, "note": "", "done": False},
                {"name": "Rice", "category": "Pantry", "store": "Costco", "qty": 1, "note": "", "done": False},
            ],
        })
        text = pdf.decode("latin-1")
        positions = {}
        for match in re.finditer(r"([0-9.]+) ([0-9.]+) Td \(([^)]*)\) Tj", text):
            x, y, label = match.groups()
            positions.setdefault(label, []).append((float(x), float(y)))
        sam = positions["Sam's"][0]
        costco = positions["Costco"][0]
        self.assertEqual(sam[1], costco[1])
        self.assertLess(sam[0], costco[0])
        self.assertIn("Apples  x2", positions)
        self.assertIn("Rice  x1", positions)

    def test_grocery_pdf_repeats_store_label_on_continuation_page(self):
        items = [
            {"name": "Item %02d" % index, "category": "Pantry", "store": "Costco", "qty": 1, "note": "", "done": False}
            for index in range(80)
        ]
        items.append({"name": "Rice", "category": "Pantry", "store": "Sam's Club", "qty": 1, "note": "", "done": False})
        pdf = grocery_print.build_groceries_pdf({
            "stores": ["Costco", "Sam's Club"],
            "categories": ["Pantry", "Other"],
            "items": [],
            "list": items,
        })
        streams = re.findall(rb"stream\n(.*?)\nendstream", pdf, re.S)
        self.assertGreater(len(streams), 1)
        continued = streams[1].decode("latin-1")
        self.assertIn("GROCERIES · CONTINUED", continued)
        self.assertEqual(continued.count("(Costco) Tj"), 1)

    def test_empty_list_still_makes_a_pdf(self):
        pdf = grocery_print.build_groceries_pdf({
            "stores": [], "categories": ["Other"], "items": [], "list": [],
        })
        self.assertTrue(pdf.startswith(b"%PDF-1.4"))
        self.assertIn(b"No items on the list.", pdf)

    def test_ipp_print_job_posts_pdf(self):
        received = {}

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                received["length"] = int(self.headers["Content-Length"])
                received["type"] = self.headers["Content-Type"]
                received["body"] = self.rfile.read(received["length"])
                body = b"\x02\x00\x00\x00\x00\x00\x00\x01\x03"
                self.send_response(200)
                self.send_header("Content-Type", "application/ipp")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            pdf = b"%PDF-1.4\nfake\n"
            grocery_print.print_pdf(
                "ipp://127.0.0.1:%d/ipp/print" % server.server_address[1],
                pdf,
                "Groceries test",
            )
        finally:
            server.shutdown()
            server.server_close()
        self.assertEqual(received["type"], "application/ipp")
        self.assertIn(b"printer-uri", received["body"])
        self.assertIn(b"document-format", received["body"])
        self.assertTrue(received["body"].endswith(pdf))

    def test_api_print_uses_saved_printer_after_list_write_and_reload(self):
        received = []

        class PrinterHandler(BaseHTTPRequestHandler):
            def do_POST(self):
                received.append(self.rfile.read(int(self.headers["Content-Length"])))
                self.send_response(200)
                self.send_header("Content-Type", "application/ipp")
                self.end_headers()
                self.wfile.write(b"\x02\x00\x00\x00\x00\x00\x00\x01\x03")

            def log_message(self, *args):
                pass

        printer = ThreadingHTTPServer(("127.0.0.1", 0), PrinterHandler)
        api = ThreadingHTTPServer(("127.0.0.1", 0), dashboard_service.ApiHandler)
        for server in (printer, api):
            threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with tempfile.TemporaryDirectory() as directory:
                config_path = os.path.join(directory, "config.json")
                saved_url = "ipp://127.0.0.1:%d/ipp/print" % printer.server_port
                with open(config_path, "w") as config_file:
                    json.dump({
                        "printer": {"name": "Kitchen", "url": saved_url},
                        "shopping": {"stores": [], "categories": ["Produce"], "list": []},
                    }, config_file)
                with patch.object(dashboard_service, "CONFIG_PATH", config_path), \
                     patch.object(dashboard_service, "_cfg", {"mtime": None, "value": {}}):
                    base = "http://127.0.0.1:%d" % api.server_port

                    def post(path, payload):
                        request = dashboard_service.urllib.request.Request(
                            base + path, data=json.dumps(payload).encode(),
                            headers={"Content-Type": "application/json"})
                        with dashboard_service.urllib.request.urlopen(request) as response:
                            return json.load(response)

                    post("/api/shopping/list", {"list": [{
                        "name": "Apples", "category": "Produce", "qty": 2,
                    }]})
                    # An old client's URL must not override the StartOS setting.
                    result = post("/api/print", {"url": "ipp://127.0.0.1:1/other"})
                    self.assertEqual(result["printer"], saved_url)
                    self.assertEqual(len(received), 1)
                    self.assertIn(saved_url.encode(), received[0])
                    self.assertIn(b"Apples", received[0])
                    with open(config_path) as config_file:
                        self.assertEqual(json.load(config_file)["printer"]["url"], saved_url)
        finally:
            for server in (api, printer):
                server.shutdown()
                server.server_close()

    def test_missing_saved_printer_cannot_be_bypassed_by_dashboard_url(self):
        api = ThreadingHTTPServer(("127.0.0.1", 0), dashboard_service.ApiHandler)
        threading.Thread(target=api.serve_forever, daemon=True).start()
        try:
            with patch.object(dashboard_service, "get_config", return_value={}), \
                 patch.object(dashboard_service, "print_pdf") as print_pdf:
                request = dashboard_service.urllib.request.Request(
                    "http://127.0.0.1:%d/api/print" % api.server_port,
                    data=b'{"url":"ipp://127.0.0.1:631/ipp/print"}',
                    headers={"Content-Type": "application/json"})
                with self.assertRaises(dashboard_service.urllib.error.HTTPError) as error:
                    dashboard_service.urllib.request.urlopen(request)
                self.assertEqual(error.exception.code, 502)
                self.assertFalse(json.load(error.exception)["ok"])
                print_pdf.assert_not_called()
        finally:
            api.shutdown()
            api.server_close()


if __name__ == "__main__":
    unittest.main()
