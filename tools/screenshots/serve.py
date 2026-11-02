#!/usr/bin/env python3
"""Serve the real built dashboard with fictional household data and live Boise weather.

No production sync loop, printer access, or live configuration is started.
"""
import argparse
import copy
import json
import mimetypes
import os
from pathlib import Path
import sys
import tempfile
from datetime import datetime, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def make_frame(fixture, sources, now):
    base = now.replace(hour=0, minute=0, second=0, microsecond=0)
    members = fixture["members"]
    keys = {m["id"]: "calendar-" + m["id"] for m in members}
    events = []

    def event(spec, offset):
        day = base + timedelta(days=offset)
        def at(hm):
            hour, minute = map(int, hm.split(":"))
            return day.replace(hour=hour, minute=minute)
        all_day = spec.get("allDay", False)
        events.append({
            "uid": "demo-event-%d" % len(events), "title": spec["title"],
            "people": [keys[p] for p in spec["people"]], "allDay": all_day,
            "start": (day if all_day else at(spec["start"])).isoformat(),
            "end": (day + timedelta(days=1) if all_day else at(spec["end"])).isoformat(),
            "location": spec.get("location", ""),
        })

    for offset in range(-40, 46):
        for spec in fixture["calendar"]["weekly"]:
            if offset != 0 and (base + timedelta(days=offset)).weekday() in spec["days"]:
                event(spec, offset)
    for spec in fixture["calendar"]["today"]:
        event(spec, 0)
    for spec in fixture["calendar"]["special"]:
        event(spec, spec["day"])

    # School and meal calendars are shown only in their own sections here, so
    # the Calendar tab keeps one lane per family member.
    school = fixture["school"]
    school_key = "calendar-school"

    def school_event(spec, offset):
        day = base + timedelta(days=offset)
        all_day = spec.get("allDay", False)
        def at(hm):
            hour, minute = map(int, hm.split(":"))
            return day.replace(hour=hour, minute=minute)
        events.append({
            "uid": "demo-school-%d" % len(events), "title": spec["title"],
            "people": [school_key], "allDay": all_day,
            "start": (day if all_day else at(spec["start"])).isoformat(),
            "end": (day + timedelta(days=1) if all_day else at(spec["end"])).isoformat(),
            "location": "",
        })

    for offset in range(-40, 46):
        for spec in school["weekly"]:
            if offset != 0 and (base + timedelta(days=offset)).weekday() in spec["days"]:
                school_event(spec, offset)
    for spec in school["special"]:
        school_event(spec, spec["day"])

    meals = fixture["meals"]
    meal_key = "calendar-meals"
    meal_items = []
    for offset in range(7):
        date = (base + timedelta(days=offset)).date().isoformat()
        for slot, titles in meals["slots"].items():
            for title in titles:
                meal_items.append({"date": date, "slot": slot, "title": title})

    from PIL import Image
    photos = []
    for i, source in enumerate(sources["photos"]):
        with Image.open(HERE / "photos" / source["file"]) as image:
            width, height = image.size
        # Sharing labels describe the fictional album, not the photographer.
        photos.append({
            "id": source["file"], "src": "/demo/photos/" + source["file"],
            "w": width, "h": height, "o": "p" if height > width else "l",
            "place": source["place"], "from": members[i % len(members)]["id"],
            "tag": fixture["photoAlbum"], "date": None,
        })

    return {
        "ok": True, "generated_at": now.isoformat(), "timezone": fixture["timezone"],
        "night": {"dim": True, "red": True}, "units": {"temperature": "fahrenheit"},
        "calendars": [{"key": keys[m["id"]], "name": m["name"], "color": m["color"],
                       "user": m["id"], "home": True, "status": "ok"} for m in members],
        "users": [dict(m, calendarKeys=[keys[m["id"]]], calendarNames=[m["name"] + "'s calendar"])
                  for m in members],
        "events": events, "chores": fixture["chores"], "photos": photos,
        "shopping": copy.deepcopy(fixture["shopping"]),
        "school": {"keys": [school_key],
                   "calendars": [{"key": school_key, "name": school["name"],
                                  "color": school["color"], "users": [], "status": "ok"}]},
        "meals": {"status": "ok", "name": meals["name"], "keys": [meal_key],
                  "calendars": [{"key": meal_key, "name": meals["name"],
                                 "color": meals["color"], "status": "ok"}],
                  "items": meal_items},
        "nav": [{"section": name, "visible": visible} for name, visible in
                [("home", True), ("weather", True), ("calendar", True),
                 ("photos", True), ("meals", False), ("school", False),
                 ("tasks", True), ("shopping", True)]],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--weather-location", type=Path,
                        help="JSON location/timezone preset for an additional weather example")
    args = parser.parse_args()
    dist = ROOT / "upstream-project/dist"
    if not (dist / "index.html").exists():
        parser.error("Build the dashboard first: cd upstream-project && npm ci && npm run build")
    fixture = json.loads((HERE / "family.json").read_text())
    if args.weather_location:
        preset = json.loads(args.weather_location.read_text())
        fixture.update({key: preset[key] for key in ("location", "timezone")})
    sources = json.loads((HERE / "photos/sources.json").read_text())
    now = datetime.now(ZoneInfo(fixture["timezone"]))
    frame = make_frame(fixture, sources, now)

    with tempfile.TemporaryDirectory(prefix="frame-screenshot-") as cache:
        # Set before importing: every production weather/map cache stays isolated.
        os.environ["DATA_DIR"] = cache
        sys.path.insert(0, str(ROOT))
        from service import dashboard_service as service
        config = {"location": fixture["location"], "timezone": fixture["timezone"],
                  "units": {"temperature": "fahrenheit"}}
        Path(cache, "config.json").write_text(json.dumps(config))
        print("Fetching live %s weather from Open-Meteo…" % fixture["location"]["name"], flush=True)
        frame["weather"] = service.sync_weather(config, ZoneInfo(fixture["timezone"]))
        runtime = {"sceneTime": now.isoformat(), "timezone": fixture["timezone"],
                   "weatherFetchedAt": datetime.now(ZoneInfo(fixture["timezone"])).isoformat(),
                   "weatherLocationPreset": args.weather_location.name if args.weather_location else None,
                   "fixture": fixture}

        class Handler(SimpleHTTPRequestHandler, service.ApiHandler):
            def __init__(self, *a, **kw):
                super().__init__(*a, directory=str(dist), **kw)

            def do_GET(self):
                path = urlsplit(self.path).path
                if path == "/api/frame":
                    self._json(json.dumps(frame).encode())
                elif path == "/demo/runtime.json":
                    self._json(json.dumps(runtime).encode())
                elif path == "/api/radar" or path.startswith(("/api/radar/tile/", "/api/basemap/", "/api/boundaries/")):
                    service.ApiHandler.do_GET(self)
                elif path.startswith("/demo/photos/"):
                    name = path[len("/demo/photos/"):]
                    if name not in {p["file"] for p in sources["photos"]}:
                        self.send_error(404)
                        return
                    body = (HERE / "photos" / name).read_bytes()
                    self.send_response(200)
                    self.send_header("Content-Type", mimetypes.guess_type(name)[0] or "application/octet-stream")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                elif path.startswith("/api/") or path.startswith("/demo/"):
                    self.send_error(404)
                else:
                    super().do_GET()

            def do_POST(self):
                if urlsplit(self.path).path != "/api/shopping/list":
                    # In particular, /api/print can never reach a real printer.
                    self._json(b'{"error":"Disabled in documentation fixture"}', 403)
                    return
                body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
                frame["shopping"]["list"] = body["list"]
                self._json(b'{"ok":true}')

            def log_message(self, *_):
                pass

        print("Screenshot fixture ready at http://%s:%d (scene %s)" % (args.host, args.port, now.isoformat()), flush=True)
        ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
