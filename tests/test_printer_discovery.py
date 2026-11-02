import contextlib
import ipaddress
import os
import struct
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

from service import grocery_print


def attribute(tag, name, value):
    name = name.encode()
    if isinstance(value, int):
        value = struct.pack('>I', value)
    elif isinstance(value, str):
        value = value.encode()
    return bytes([tag]) + struct.pack('>H', len(name)) + name + struct.pack('>H', len(value)) + value


def printer_reply(pdf=True, print_job=True):
    body = b'\x01\x01\x00\x00\x00\x00\x00\x01\x04'
    body += attribute(0x42, 'printer-name', 'Kitchen printer')
    body += attribute(0x41, 'printer-make-and-model', 'Test IPP Printer')
    body += attribute(0x23, 'printer-state', 3)
    body += attribute(0x23, 'operations-supported', 11)
    if print_job:
        body += attribute(0x23, '', 2)
    body += attribute(0x49, 'document-format-supported', 'image/jpeg')
    if pdf:
        body += attribute(0x49, '', 'application/pdf')
    body += attribute(0x45, 'printer-uuid', 'urn:uuid:test-kitchen')
    return body + b'\x03'


@contextlib.contextmanager
def endpoint(reply=None, content_type='application/ipp', path='/ipp/print'):
    requests = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            body = self.rfile.read(int(self.headers['Content-Length']))
            requests.append((self.path, body))
            if self.path != path:
                self.send_error(404)
                return
            response = printer_reply() if reply is None else reply
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(response)))
            self.end_headers()
            self.wfile.write(response)

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        yield server.server_port, requests
    finally:
        server.shutdown()
        server.server_close()


class DiscoveryTests(unittest.TestCase):
    def test_subnet_probe_finds_real_ipp_endpoint_not_just_open_port(self):
        with endpoint(path='/ipp/printer') as (port, requests), \
             patch.object(grocery_print, 'PRINTER_PORTS', (('ipp', port),)):
            printer = grocery_print._probe_host('127.0.0.1', time.monotonic() + 5)
        self.assertEqual(printer['name'], 'Kitchen printer')
        self.assertEqual(printer['url'], 'ipp://127.0.0.1:%d/ipp/printer' % port)
        self.assertEqual(printer['model'], 'Test IPP Printer')
        self.assertIn('application/pdf', printer['formats'])
        self.assertTrue(all(body[2:4] == b'\x00\x0b' for _, body in requests))
        self.assertTrue(all(b'%PDF' not in body for _, body in requests))

    def test_open_web_server_is_not_a_printer(self):
        with endpoint(reply=b'<html>Administration</html>', content_type='text/html') as (port, _), \
             patch.object(grocery_print, 'PRINTER_PORTS', (('ipp', port),)):
            self.assertIsNone(grocery_print._probe_host('127.0.0.1', time.monotonic() + 5))

    def test_ipp_device_must_support_pdf_and_print_job(self):
        for pdf, print_job in ((False, True), (True, False)):
            with self.subTest(pdf=pdf, print_job=print_job), \
                 endpoint(reply=printer_reply(pdf, print_job)) as (port, _):
                self.assertIsNone(grocery_print._query_printer(
                    'ipp://127.0.0.1:%d/ipp/print' % port, time.monotonic() + 5))

    def test_truncated_failed_and_mismatched_ipp_responses_are_rejected(self):
        reply = printer_reply()
        for broken in (reply[:-1], reply[:10], reply[:2] + b'\x04\x06' + reply[4:],
                       reply[:7] + b'\x02' + reply[8:]):
            with self.subTest(reply=broken):
                self.assertIsNone(grocery_print._printer_attributes(broken))

    def test_private_subnet_scope_rejects_public_ipv6_and_unbounded_scans(self):
        self.assertEqual(str(grocery_print._private_subnet('192.168.1.171/24')), '192.168.1.0/24')
        self.assertEqual(str(grocery_print._private_subnet('10.1.0.0/22')), '10.1.0.0/22')
        for value in ('8.8.8.0/24', '127.0.0.0/24', '::1/128', '192.168.0.0/16', '0.0.0.0/0'):
            with self.subTest(subnet=value), self.assertRaises(ValueError):
                grocery_print._private_subnet(value)

    def test_detects_only_bounded_directly_connected_private_routes(self):
        routes = (
            'Iface Destination Gateway Flags RefCnt Use Metric Mask MTU Window IRTT\n'
            'eth0 00000000 0101A8C0 0003 0 0 0 00000000 0 0 0\n'
            'eth0 0001A8C0 00000000 0001 0 0 0 00FFFFFF 0 0 0\n'
            'eth0 0001A8C0 00000000 0001 0 0 0 00FFFFFF 0 0 0\n'
            'docker0 000011AC 00000000 0001 0 0 0 0000FFFF 0 0 0\n'
            'eth1 0002A8C0 00000000 0000 0 0 0 00FFFFFF 0 0 0\n'
            'eth0 0003A8C0 0101A8C0 0003 0 0 0 00FFFFFF 0 0 0\n'
            'eth0 00080808 00000000 0001 0 0 0 00FFFFFF 0 0 0\n')
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, 'route')
            with open(path, 'w') as file:
                file.write(routes)
            self.assertEqual(grocery_print._local_subnets(path), [ipaddress.ip_network('192.168.1.0/24')])

    def test_unicast_discovery_works_when_bonjour_cannot_start(self):
        with endpoint() as (port, _), \
             patch.object(grocery_print, 'PRINTER_PORTS', (('ipp', port),)), \
             patch.object(grocery_print, '_local_subnets', return_value=[ipaddress.ip_network('127.0.0.0/30')]), \
             patch.object(grocery_print, '_bonjour_printers', side_effect=RuntimeError('No multicast')), \
             patch.object(grocery_print, '_discovery_cache', {'at': 0, 'printers': []}):
            printers = grocery_print.discover_printers(force=True)
        self.assertEqual([printer['url'] for printer in printers], ['ipp://127.0.0.1:%d/ipp/print' % port])

    def test_same_printer_at_different_endpoints_is_deduplicated(self):
        with endpoint() as (port, _), endpoint() as (other_port, _), \
             patch.object(grocery_print, 'PRINTER_PORTS', (('ipp', port),)), \
             patch.object(grocery_print, '_local_subnets', return_value=[ipaddress.ip_network('127.0.0.0/30')]), \
             patch.object(grocery_print, '_bonjour_printers', return_value=[{'url': 'ipp://127.0.0.1:%d/ipp/print' % other_port}]), \
             patch.object(grocery_print, '_discovery_cache', {'at': 0, 'printers': []}):
            printers = grocery_print.discover_printers(force=True)
        self.assertEqual([printer['name'] for printer in printers], ['Kitchen printer'])

    def test_slow_ipp_response_respects_query_deadline(self):
        release = threading.Event()

        class SlowPrinter(BaseHTTPRequestHandler):
            def do_POST(self):
                self.rfile.read(int(self.headers['Content-Length']))
                self.send_response(200)
                self.send_header('Content-Type', 'application/ipp')
                self.send_header('Content-Length', str(len(printer_reply())))
                self.end_headers()
                release.wait(2)
                try:
                    self.wfile.write(printer_reply())
                except OSError:
                    pass

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(('127.0.0.1', 0), SlowPrinter)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with patch.object(grocery_print, 'QUERY_TIMEOUT', 0.1):
                self.assertIsNone(grocery_print._query_printer(
                    'ipp://127.0.0.1:%d/ipp/print' % server.server_port, time.monotonic() + 5))
        finally:
            release.set()
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    unittest.main()
