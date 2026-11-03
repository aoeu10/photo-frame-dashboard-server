import unittest
from unittest.mock import patch

from service import dashboard_service as service

ALBUM_ID = "11111111-1111-4111-8111-111111111111"
ASSET_ID = "22222222-2222-4222-8222-222222222222"
ASSET_ID_2 = "33333333-3333-4333-8333-333333333333"
SERVER = "http://192.168.1.50:2283"


def image_asset(asset_id=ASSET_ID, **overrides):
    asset = {
        "id": asset_id,
        "type": "IMAGE",
        "width": 1200,
        "height": 800,
        "fileCreatedAt": "2023-08-12T14:30:00.000Z",
        "createdAt": "2023-08-13T09:00:00.000Z",
        "exifInfo": {"dateTimeOriginal": "2023-08-12T14:30:00.000+02:00"},
    }
    asset.update(overrides)
    return asset


class ImmichParsingTests(unittest.TestCase):
    def test_accepts_bare_id_and_album_page_link(self):
        self.assertEqual(service.parse_immich_album(ALBUM_ID), ALBUM_ID)
        self.assertEqual(
            service.parse_immich_album(
                "https://photos.example.com/albums/%s" % ALBUM_ID
            ),
            ALBUM_ID,
        )
        self.assertEqual(
            service.parse_immich_album(
                "https://example.com/immich/albums/%s/?tab=photos" % ALBUM_ID
            ),
            ALBUM_ID,
        )

    def test_rejects_non_album_links(self):
        self.assertIsNone(service.parse_immich_album("https://example.com/share/abc"))
        self.assertIsNone(service.parse_immich_album("not a link"))
        self.assertIsNone(service.parse_immich_album(""))

    def test_normalizes_server_and_rejects_credentials(self):
        self.assertEqual(
            service.normalize_immich_server(" https://example.com/immich/ "),
            "https://example.com/immich",
        )
        self.assertIsNone(
            service.normalize_immich_server("https://user:pass@example.com")
        )
        self.assertIsNone(service.normalize_immich_server("ftp://example.com"))

    def test_https_local_hosts_accept_self_signed_certs(self):
        for server in (
            "https://embassy-tinted-zippers.local:52717",
            "https://192.168.1.171:2283",
            "https://10.0.0.5",
            "https://localhost:2283",
        ):
            context = service.immich_ssl_context(server)
            self.assertIsNotNone(context, server)
            self.assertEqual(context.verify_mode, service.ssl.CERT_NONE, server)
        self.assertIsNone(service.immich_ssl_context("https://photos.example.com"))
        self.assertIsNone(service.immich_ssl_context("http://192.168.1.50:2283"))

    def test_derives_server_from_album_link(self):
        self.assertEqual(
            service.immich_source(
                {"albumId": "https://example.com/immich/albums/%s" % ALBUM_ID}
            ),
            ("https://example.com/immich", ALBUM_ID),
        )
        self.assertEqual(
            service.immich_source(
                {"server": SERVER, "albumId": ALBUM_ID}
            ),
            (SERVER, ALBUM_ID),
        )


class ImmichAlbumTests(unittest.TestCase):
    def test_skips_videos_trashed_assets_and_uses_exif_time(self):
        album = {
            "albumName": "Summer",
            "assets": [
                image_asset(),
                image_asset(ASSET_ID_2, type="VIDEO"),
                image_asset(ASSET_ID_2, isTrashed=True),
            ],
        }
        with patch.object(service, "immich_json", return_value=album):
            fetched = service.immich_album_photos(SERVER, "key", ALBUM_ID)
        self.assertEqual(fetched["name"], "Summer")
        self.assertEqual(len(fetched["photos"]), 1)
        photo = fetched["photos"][0]
        self.assertEqual(photo["id"], ASSET_ID)
        self.assertEqual(
            photo["src"], "/api/immich/photo/%s/%s?size=preview" % (ALBUM_ID, ASSET_ID)
        )
        self.assertEqual(
            photo["thumbsrc"],
            "/api/immich/photo/%s/%s?size=thumbnail" % (ALBUM_ID, ASSET_ID),
        )
        self.assertEqual(photo["w"], 1200)
        self.assertEqual(photo["h"], 800)
        self.assertEqual(photo["offset"], 7200)
        self.assertEqual(
            service._photo_time(photo["taken_ms"], photo["offset"]).date().isoformat(),
            "2023-08-12",
        )

    def test_prefers_local_datetime_over_utc_timestamps(self):
        album = {
            "albumName": "Evening",
            "assets": [image_asset(
                localDateTime="2024-05-19T23:30:00.000",
                fileCreatedAt="2024-05-20T06:30:00.000Z",
                exifInfo={"dateTimeOriginal": "2024-05-20T06:30:00.000Z"},
            )],
        }
        with patch.object(service, "immich_json", return_value=album):
            fetched = service.immich_album_photos(SERVER, "key", ALBUM_ID)
        photo = fetched["photos"][0]
        self.assertEqual(photo["offset"], 0)
        self.assertEqual(
            service._photo_time(photo["taken_ms"], photo["offset"]).date().isoformat(),
            "2024-05-19",
        )

    def test_falls_back_to_search_when_album_omits_assets(self):
        calls = []

        def fake_json(server, path, api_key, body=None):
            if path.startswith("/api/albums/"):
                return {"albumName": "Fallback"}
            calls.append(body)
            if body.get("cursor") == "next":
                return {"assets": {"items": [image_asset(ASSET_ID_2)],
                                   "nextCursor": None}}
            return {"assets": {"items": [image_asset()], "nextCursor": "next"}}

        with patch.object(service, "immich_json", side_effect=fake_json):
            fetched = service.immich_album_photos(SERVER, "key", ALBUM_ID)
        self.assertEqual([p["id"] for p in fetched["photos"]], [ASSET_ID, ASSET_ID_2])
        self.assertEqual(calls[0]["filter"]["albumIds"]["all"], [ALBUM_ID])
        self.assertEqual(calls[1]["cursor"], "next")

    def test_search_falls_back_to_deprecated_paging(self):
        calls = []

        def fake_json(server, path, api_key, body=None):
            if path.startswith("/api/albums/"):
                return {"albumName": "Old server"}
            calls.append(body)
            if "filter" in body:
                raise service.ImmichHttpError(400, "unknown field")
            if body["page"] == 1:
                return {"assets": {"total": 2, "items": [image_asset()]}}
            return {"assets": {"total": 2, "items": [image_asset(ASSET_ID_2)]}}

        with patch.object(service, "immich_json", side_effect=fake_json):
            fetched = service.immich_album_photos(SERVER, "key", ALBUM_ID)
        self.assertEqual([p["id"] for p in fetched["photos"]], [ASSET_ID, ASSET_ID_2])
        self.assertEqual(calls[1]["albumIds"], [ALBUM_ID])


class ImmichManifestTests(unittest.TestCase):
    def test_adds_immich_album_info_and_manifest_entries(self):
        fetched = {
            "name": "Summer 2023",
            "photos": [
                {
                    "id": ASSET_ID,
                    "src": "/api/immich/photo/%s/%s?size=preview" % (ALBUM_ID, ASSET_ID),
                    "thumbsrc": "/api/immich/photo/%s/%s?size=thumbnail" % (ALBUM_ID, ASSET_ID),
                    "w": 800,
                    "h": 1200,
                    "taken_ms": 1691841000000,
                    "offset": 7200,
                    "added_ms": 1691917200000,
                }
            ],
        }
        config = {
            "immichAlbums": [
                {
                    "server": SERVER,
                    "apiKey": "secret",
                    "albumId": ALBUM_ID,
                    "name": "Our summer",
                }
            ]
        }
        with patch.object(service, "immich_album_photos", return_value=fetched):
            manifest, albums = service.build_album_manifest(config)
        self.assertEqual(len(albums), 1)
        info = albums[0]
        self.assertEqual(info["provider"], "immich")
        self.assertEqual(info["server"], SERVER)
        self.assertEqual(info["name"], "Summer 2023")
        self.assertEqual(info["photoCount"], 1)
        self.assertEqual(info["datedPhotoCount"], 1)
        self.assertEqual(info["status"], "ok")
        self.assertEqual(info["oldestTaken"], "2023-08-12")
        self.assertEqual(info["newestTaken"], "2023-08-12")
        self.assertEqual(len(manifest), 1)
        entry = manifest[0]
        self.assertEqual(entry["place"], "Our summer")
        self.assertEqual(entry["o"], "p")
        self.assertEqual(entry["date"], "2023-08-12")
        self.assertIn("thumbsrc", entry)
        self.assertNotIn("secret", repr(manifest))

    def test_reports_invalid_link_missing_key_and_sync_failure(self):
        config = {
            "immichAlbums": [
                {"server": "not a server", "albumId": ALBUM_ID},
                {"server": SERVER, "albumId": ALBUM_ID},
                {"server": SERVER, "albumId": ALBUM_ID, "apiKey": "key"},
            ]
        }
        with patch.object(
            service, "immich_album_photos", side_effect=ValueError("rejected")
        ):
            _, albums = service.build_album_manifest(config)
        self.assertEqual([a["status"] for a in albums],
                         ["invalid-link", "error", "error"])
        self.assertEqual(albums[1]["error"], "Immich API key is missing.")
        self.assertIn("Could not read the Immich album", albums[2]["error"])

    def test_icloud_entries_keep_the_icloud_provider(self):
        config = {"albums": [{"url": "bad", "name": "Old"}]}
        manifest, albums = service.build_album_manifest(config)
        self.assertEqual(manifest, [])
        self.assertEqual(albums[0]["provider"], "icloud")
        self.assertEqual(albums[0]["status"], "invalid-link")


class ImmichThumbnailTests(unittest.TestCase):
    def test_rejects_unsupported_size(self):
        with self.assertRaises(ValueError):
            service.immich_thumbnail(SERVER, "key", ASSET_ID, "original")


if __name__ == "__main__":
    unittest.main()
