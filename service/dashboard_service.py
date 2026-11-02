#!/usr/bin/env python3
"""Dashboard sync + API service.

Threads:
  - sync loop: every sync_interval_minutes (or immediately when
    /data/sync.now.json appears) fetches the configured public iCloud shared
    album METADATA (the frame streams the images from Apple's CDN), merges the
    configured ICS calendars, fetches the Open-Meteo forecast, and writes
    /data/frame_cache.json.
  - API server on 127.0.0.1:8080: GET /api/frame serves the latest document
    (nginx proxies /api/ here). The frame never talks to anything but nginx
    and Apple's photo CDN.

Config: /data/config.json (written by the StartOS config actions), re-read
whenever its mtime changes. No restart needed.
"""
import io
import json
import math
import os
import re
import threading
import time
import urllib.parse
import urllib.error
import urllib.request
import zoneinfo
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from PIL import Image

try:
    from .grocery_print import build_groceries_pdf, discover_printers, print_pdf
    from . import vestaboard
except ImportError:
    from grocery_print import build_groceries_pdf, discover_printers, print_pdf
    import vestaboard

DATA_DIR = os.environ.get("DATA_DIR", "/data")
CONFIG_PATH = os.path.join(DATA_DIR, "config.json")
CACHE_PATH = os.path.join(DATA_DIR, "frame_cache.json")
SYNC_FLAG_PATH = os.path.join(DATA_DIR, "sync.now.json")

MAX_SYNC_PAGES = 100
MAX_PHOTO_EDGE = 1600
ICAL_PAST_DAYS = 7
ICAL_AHEAD_DAYS = 35

_log_lock = threading.Lock()


def log(msg):
    with _log_lock:
        print("[dashboard] " + msg, flush=True)


# ---------------------------------------------------------------- config
_cfg_lock = threading.Lock()
_cfg = {"mtime": None, "value": {}}


def get_config():
    with _cfg_lock:
        try:
            mtime = os.stat(CONFIG_PATH).st_mtime
        except OSError:
            return {}
        if _cfg["mtime"] != mtime:
            try:
                with open(CONFIG_PATH, encoding="utf-8") as f:
                    _cfg["value"] = json.load(f)
                _cfg["mtime"] = mtime
                log("config reloaded")
            except Exception as e:
                log("config parse failed: %r" % (e,))
                return {}
        return _cfg["value"]


# ---------------------------------------------------------------- icloud albums
def parse_album_url(text):
    """(token, china) from the two public shared-album link forms, else None."""
    u = urllib.parse.urlparse((text or "").strip())
    host = (u.hostname or "").lower()
    if u.scheme not in ("https", ""):
        return None
    china = host.endswith(".com.cn")
    base = host[: -len(".cn")] if china else host
    if base == "photos.icloud.com":
        m = re.fullmatch(r"/shared/album/([A-Za-z0-9_-]{10,200})/?", u.path)
        if m:
            return m.group(1), china
    if base in ("www.icloud.com", "icloud.com"):
        if re.fullmatch(r"/sharedalbum/?", u.path) and u.fragment and re.fullmatch(r"[A-Za-z0-9_-]{10,200}", u.fragment):
            return u.fragment, china
    return None


def http_json(url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method="POST" if data else "GET")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def album_photos(token, china):
    """Album title and photos from the modern CPL API.
    Capture timestamps and album-added timestamps remain separate."""
    root = "icloud.com.cn" if china else "icloud.com"
    path = "/database/1/com.apple.photos.cloud/production/"
    key = "?remapEnums=true&getCurrentSyncToken=true&sharing_url_key=" + urllib.parse.quote(token)
    resolved = http_json("https://ckdatabasews." + root + path + "public/records/resolve" + key,
                         {"shortGUIDs": [{"value": token, "shouldFetchRootRecord": True}]})
    result = resolved["results"][0]
    access = result["anonymousPublicAccess"]
    partition = int(access["resolvedPartitionNumber"])
    if not 1 <= partition <= 999:
        raise ValueError("Invalid partition")
    query_url = "https://p%02d-ckdatabasews.%s%sshared/records/query%s&publicAccessAuthToken=%s" % (
        partition, root, path, key, urllib.parse.quote(access["token"]))
    zone = result["zoneID"]
    request = {"query": {"recordType": "CPLAssetAndMasterByAddedDate",
                         "filterBy": [{"fieldName": "direction", "comparator": "EQUALS",
                                       "fieldValue": {"value": "ASCENDING", "type": "STRING"}},
                                      {"fieldName": "startRank", "comparator": "EQUALS",
                                       "fieldValue": {"value": 0, "type": "INT64"}}]},
               "zoneID": zone, "resultsLimit": 200}
    masters, assets, photos = {}, {}, {}
    seen_markers = set()
    for _ in range(MAX_SYNC_PAGES):
        response = http_json(query_url, request)
        if response.get("serverErrorCode"):
            raise ValueError("Album service rejected request: %s" % response.get("serverErrorMessage"))
        for rec in response.get("records", []):
            name = rec.get("recordName")
            if rec.get("deleted"):
                assets.pop(name, None)
                masters.pop(name, None)
                continue
            rtype = rec.get("recordType")
            if rtype == "CPLMaster":
                masters[name] = rec
            elif rtype == "CPLAsset":
                assets[name] = rec
        marker = response.get("continuationMarker")
        if not marker:
            break
        if marker in seen_markers:
            raise ValueError("Repeated pagination cursor")
        seen_markers.add(marker)
        request["continuationMarker"] = marker
    for guid, record in assets.items():
        asset = record.get("fields", {})
        master = (masters.get((asset.get("masterRef", {}).get("value", {}) or {}).get("recordName")) or {}).get("fields", {})
        if _is_video(asset, master):
            continue
        url, width, height = _pick_rendition(asset, master)
        if not url:
            continue
        taken = _field_num(asset, "assetDate", _field_num(master, "originalCreationDate", 0))
        photos[guid] = {"id": guid, "src": url, "w": width, "h": height,
                        "taken_ms": taken, "offset": _field_num(asset, "timeZoneOffset", None),
                        "added_ms": _field_num(asset, "mostRecentAddedDate", _field_num(asset, "addedDate", 0))}
    title = _field_str((result.get("share") or {}).get("fields", {}), "cloudkit.title")
    return {"name": title, "photos": list(photos.values())}


def _is_video(asset, master):
    itype = (_field_str(master, "itemType") or "").lower()
    return ("video" in itype or "movie" in itype or "mpeg" in itype
            or _field_num(asset, "duration", 0) > 0
            or _field_num(asset, "isHidden", 0) != 0
            or _field_num(asset, "isTrashed", 0) != 0)


def _pick_rendition(asset, master):
    """Smallest rendition with width >= 800, else the largest available."""
    best = None
    for fields in (asset, master):
        for key in ("resJPEGFullRes", "resJPEGLargeRes", "resJPEGMedRes", "resJPEGThumbRes"):
            v = (fields.get(key, {}) or {}).get("value", {}) or {}
            url = v.get("downloadURL")
            if not url:
                continue
            width = int(v.get("width") or _field_num(master, "resOriginalWidth", 0))
            if not best or (width >= 800 and (best[1] < 800 or width < best[1])) or (width < 800 and width > best[1]):
                best = (url, width, int(v.get("height") or _field_num(master, "resOriginalHeight", 0)))
    return best or ("", 0, 0)


def _field_str(fields, key):
    return (fields.get(key, {}) or {}).get("value", "") or ""


def _field_num(fields, key, fallback=0):
    v = (fields.get(key, {}) or {}).get("value")
    try:
        return int(v)
    except (TypeError, ValueError):
        return fallback


def legacy_album_photos(token, china):
    root = "icloud.com.cn" if china else "icloud.com"
    base = "https://p01-sharedstreams." + root + "/" + token
    stream = http_json(base + "/sharedstreams/webstream", {"streamCtag": None})
    host = stream.get("X-Apple-MMe-Host")
    if host and re.fullmatch(r"p[0-9]{2,3}-sharedstreams\.icloud\.com(\.cn)?", host):
        base = "https://" + host + "/" + token
        stream = http_json(base + "/sharedstreams/webstream", {"streamCtag": None})
    items, locations = {}, {}
    shared_photos = stream.get("photos", [])
    for start in range(0, len(shared_photos), 100):
        ids = [p["photoGuid"] for p in shared_photos[start:start + 100]]
        urls = http_json(base + "/sharedstreams/webasseturls", {"photoGuids": ids})
        items.update(urls.get("items", {}))
        locations.update(urls.get("locations", {}))
    photos = []
    for p in shared_photos:
        if (p.get("mediaAssetType") or "").lower().find("video") > -1 or float(p.get("videoDuration") or 0) > 0:
            continue
        derivatives = p.get("derivatives") or {}
        best, best_px = None, -1
        for d in derivatives.values():
            px = int(d.get("width") or 0) * int(d.get("height") or 0)
            if px > best_px and d.get("checksum") in items:
                best, best_px = d, px
        if not best:
            continue
        item = items[best["checksum"]]
        loc = locations[str(item["url_location"])]
        url = loc["scheme"] + "://" + loc["hosts"][0] + item["url_path"]
        photos.append({"id": p["photoGuid"], "src": url,
                       "w": int(best.get("width") or 0), "h": int(best.get("height") or 0),
                       "taken_ms": _parse_timestamp(p.get("dateCreated")), "offset": None,
                       "added_ms": _parse_timestamp(p.get("batchDateCreated"))})
    return {"name": stream.get("streamName") or "", "photos": photos}


def _parse_timestamp(value):
    if not value:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return int(parsed.timestamp() * 1000)
        except (AttributeError, TypeError, ValueError):
            return None


def _photo_time(timestamp, offset=None):
    """Use the photo's own offset when supplied, otherwise UTC, never sync time."""
    if not timestamp:
        return None
    try:
        zone = timezone(timedelta(seconds=offset)) if offset is not None else timezone.utc
        return datetime.fromtimestamp(timestamp / 1000, tz=zone)
    except (TypeError, ValueError, OverflowError, OSError):
        return None

# ---------------------------------------------------------------- photos (streaming)
# Like iphoto-frame-saver, photos are never copied to a folder: the box fetches
# only the album METADATA (guid + rendition URLs + dates) on its sync interval,
# and the frame streams each image straight from Apple's CDN when it renders it.


def build_album_manifest(config):
    """Photo manifest and per-album sync information; no image downloads."""
    manifest, albums = [], []
    for album in config.get("albums") or []:
        label = album.get("name") or ""
        info = {"configuredName": label, "name": "", "photoCount": 0,
                "datedPhotoCount": 0, "oldestTaken": None, "newestTaken": None,
                "status": "ok", "error": None}
        albums.append(info)
        parsed = parse_album_url(album.get("url"))
        if not parsed:
            info.update(status="invalid-link", error="Not a public iCloud shared-album link.")
            log("album skipped (unrecognized public shared-album link)")
            continue
        token, china = parsed
        try:
            try:
                fetched = album_photos(token, china)
            except Exception as e:
                log("modern album API failed (%r); trying legacy" % (e,))
                fetched = legacy_album_photos(token, china)
        except Exception as e:
            log("album manifest failed: %r" % (e,))
            info.update(status="error", error="Could not read the public album. Check the link and run Sync Now.")
            continue
        info["name"] = fetched["name"]
        dates = []
        for photo in fetched["photos"]:
            taken = _photo_time(photo["taken_ms"], photo["offset"])
            added = _photo_time(photo["added_ms"])
            date = taken.date().isoformat() if taken else None
            if date:
                dates.append(date)
            manifest.append({"src": photo["src"], "w": photo["w"], "h": photo["h"],
                             "o": "p" if photo["h"] > photo["w"] else "l",
                             "date": date, "takenAt": taken.isoformat() if taken else None,
                             "addedAt": added.isoformat() if added else None,
                             "place": label or fetched["name"] or "Shared album"})
        info.update(photoCount=len(fetched["photos"]), datedPhotoCount=len(dates),
                    oldestTaken=min(dates) if dates else None, newestTaken=max(dates) if dates else None)
    manifest.sort(key=lambda p: p["date"] or "", reverse=True)
    log("album manifest: %d photos" % len(manifest))
    return manifest, albums


# ---------------------------------------------------------------- calendars
def sync_calendars(config, zone):
    try:
        import recurring_ical_events as rie
        from icalendar import Calendar
    except ImportError as e:
        log("calendar packages unavailable: %r" % (e,))
        return [], []
    day0 = datetime.combine(datetime.now(tz=zone).date(), datetime.min.time(), tzinfo=zone)
    start = day0 - timedelta(days=ICAL_PAST_DAYS)
    end = day0 + timedelta(days=ICAL_AHEAD_DAYS)
    events, meta = [], []
    for i, cal in enumerate(config.get("calendars") or []):
        key = "cal%d" % i
        m = {"key": key, "name": cal.get("name") or key, "color": cal.get("color") or "#111111",
             "user": str(cal.get("user") or ""), "home": cal.get("showOnHome") is not False}
        try:
            req = urllib.request.Request(cal["url"])
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
            calendar = Calendar.from_ical(data)
            for ev in rie.of(calendar).between(start, end):
                summary = str(ev.get("SUMMARY") or "Busy")
                start_dt = ev.get("DTSTART").dt
                end_dt = ev.get("DTEND").dt if ev.get("DTEND") else start_dt
                all_day = not isinstance(start_dt, datetime)
                s = start_dt if isinstance(start_dt, datetime) else datetime.combine(start_dt, datetime.min.time(), tzinfo=zone)
                e = end_dt if isinstance(end_dt, datetime) else datetime.combine(end_dt, datetime.min.time(), tzinfo=zone)
                if s.tzinfo is None:
                    s = s.replace(tzinfo=zone)
                if e.tzinfo is None:
                    e = e.replace(tzinfo=zone)
                events.append({"uid": "%s-%s" % (key, str(ev.get("UID") or len(events))),
                               "title": summary, "start": s.isoformat(), "end": e.isoformat(),
                               "allDay": all_day, "people": [key],
                               "loc": str(ev.get("LOCATION") or "") if ev.get("LOCATION") else ""})
            m["status"] = "ok"
        except Exception as e:
            m["status"] = "unavailable"
            log("calendar failed (%s): %r" % (cal.get("name"), e))
        meta.append(m)
    events.sort(key=lambda e: (not e["allDay"], e["start"]))
    return events, meta


# ---------------------------------------------------------------- school + meals
MEAL_SLOTS = (("breakfast", 7, 9), ("lunch", 11, 13), ("dinner", 17, 19))
MEAL_DAYS = 7


def _flagged_calendars(config, calendars, flag):
    """Metadata for configured calendars whose boolean ``flag`` is true."""
    out = []
    for i, cal in enumerate(config.get("calendars") or []):
        if cal.get(flag) is not True:
            continue
        key = "cal%d" % i
        name = str(cal.get("name") or "").strip() or key
        meta = next((c for c in calendars if c.get("key") == key), {})
        out.append({"key": key, "name": name,
                    "color": meta.get("color") or cal.get("color") or "#111111",
                    "status": meta.get("status")})
    return out


def build_school(config, calendars):
    """School metadata for calendars marked ``school`` in Edit Calendars.

    Their events already arrive through sync_calendars as ``cal<N>`` people, so
    this only publishes which calendars feed the School section.
    """
    school = _flagged_calendars(config, calendars, "school")
    return {"keys": [c["key"] for c in school], "calendars": school}


def build_meals(config, events, calendars, zone):
    """Today-and-ahead meal entries for calendars marked ``meal``.

    Breakfast is 7:00-8:59, lunch 11:00-12:59 and dinner 17:00-18:59; entries
    starting outside those windows are ignored. All-day entries have no slot.
    """
    meal = _flagged_calendars(config, calendars, "meal")
    if not meal:
        return {"status": "off", "name": "", "keys": [],
                "calendars": [], "items": []}
    keys = {c["key"] for c in meal}
    names = [c["name"] for c in meal]
    today = datetime.now(tz=zone).date()
    end = today + timedelta(days=MEAL_DAYS)
    slots = [label for label, _, _ in MEAL_SLOTS]
    items = []
    for ev in events:
        if ev.get("allDay"):
            continue
        if not any(p in keys for p in (ev.get("people") or [])):
            continue
        try:
            start = datetime.fromisoformat(ev["start"])
        except (KeyError, TypeError, ValueError):
            continue
        if start.tzinfo is None:
            start = start.replace(tzinfo=zone)
        local = start.astimezone(zone)
        if not (today <= local.date() < end):
            continue
        slot = next((label for label, lo, hi in MEAL_SLOTS if lo <= local.hour < hi), None)
        if not slot:
            continue
        items.append({"date": local.date().isoformat(), "slot": slot,
                      "title": ev.get("title") or "Meal"})
    items.sort(key=lambda x: (x["date"], slots.index(x["slot"])))
    unavailable = all(c.get("status") == "unavailable" for c in meal)
    return {"status": "unavailable" if unavailable else "ok",
            "name": " · ".join(names),
            "keys": [c["key"] for c in meal],
            "calendars": meal, "items": items}


# ---------------------------------------------------------------- weather
WCODE = {0: "sun", 1: "sun", 2: "partly", 3: "cloud", 45: "cloud", 48: "cloud",
         51: "rain", 53: "rain", 55: "rain", 56: "rain", 57: "rain",
         61: "rain", 63: "rain", 65: "rain", 66: "rain", 67: "rain",
         71: "cloud", 73: "cloud", 75: "cloud", 77: "cloud",
         80: "rain", 81: "rain", 82: "rain", 85: "rain", 86: "rain", 95: "rain",
         96: "rain", 99: "rain"}
CLEAR_CODES = (0, 1)


def condition(code, is_day=1):
    """Dashboard condition token. Open-Meteo reports a WMO code, not a label;
    clear skies become "moon" at night so the frame says Clear, not Sunny."""
    cond = WCODE.get(code, "cloud")
    if cond == "sun" and code in CLEAR_CODES and not is_day:
        return "moon"
    return cond


def sync_weather(config, zone):
    loc = config.get("location") or {}
    lat, lon = loc.get("lat") or 0, loc.get("lon") or 0
    if not lat and not lon:
        return None
    unit = "fahrenheit" if (config.get("units", {}).get("temperature", "fahrenheit").startswith("f")) else "celsius"
    tzname = config.get("timezone") or str(zone)
    q = urllib.parse.urlencode({
        "latitude": lat, "longitude": lon,
        "hourly": "temperature_2m,precipitation_probability,weathercode,precipitation,is_day",
        "daily": ("weathercode,temperature_2m_max,temperature_2m_min,"
                  "precipitation_probability_max,sunrise,sunset,wind_speed_10m_max,uv_index_max"),
        "current": ("temperature_2m,apparent_temperature,relative_humidity_2m,"
                    "wind_speed_10m,wind_gusts_10m,surface_pressure,precipitation,weathercode,is_day"),
        "temperature_unit": unit, "wind_speed_unit": "mph",
        "timezone": tzname or "auto", "forecast_days": 7,
    })
    doc = http_json("https://api.open-meteo.com/v1/forecast?" + q)
    hourly, daily = doc["hourly"], doc["daily"]
    # today's 24 hourly slots, keyed by hour-of-day
    t = [None] * 24
    c = [None] * 24
    p = [None] * 24
    mm = [None] * 24
    today = daily["time"][0]
    for i, ts in enumerate(hourly["time"]):
        if ts[:10] != today:
            continue
        hh = int(ts[-5:-3])
        if 0 <= hh < 24:
            t[hh] = round(hourly["temperature_2m"][i])
            p[hh] = round(hourly["precipitation_probability"][i] or 0)
            c[hh] = condition(hourly["weathercode"][i], hourly["is_day"][i])
            mm[hh] = round(float(hourly["precipitation"][i] or 0), 1)
    for arr in (t, c, p, mm):
        for i in range(24):
            if arr[i] is None:
                arr[i] = arr[i - 1] if i else 0

    now = doc.get("current") or {}
    # Forward-looking hours: the frame's hourly strip must not wrap past midnight
    # onto this morning's slots. Build the next 12 from the sync time.
    next_hours = []
    try:
        gen = datetime.fromisoformat(doc["current"]["time"])
    except (KeyError, TypeError, ValueError):
        gen = datetime.now(tz=zone)
    for i, ts in enumerate(hourly["time"]):
        try:
            when = datetime.fromisoformat(ts)
        except (TypeError, ValueError):
            continue
        if when < gen.replace(minute=0, second=0, microsecond=0):
            continue
        next_hours.append({
            "hour": when.hour,
            "day": when.strftime("%Y-%m-%d"),
            "t": round(hourly["temperature_2m"][i]),
            "c": condition(hourly["weathercode"][i], hourly["is_day"][i]),
            "p": round(hourly["precipitation_probability"][i] or 0),
        })
        if len(next_hours) >= 12:
            break
    # Seven-day outlook: day label, condition icon, high/low, rain chance, sun times.
    days = []
    for i, day in enumerate(daily["time"]):
        days.append({
            "date": day,
            "cond": WCODE.get(daily["weathercode"][i], "cloud"),
            "hi": round(daily["temperature_2m_max"][i]),
            "lo": round(daily["temperature_2m_min"][i]),
            "p": round(daily["precipitation_probability_max"][i] or 0),
            "wind": round(daily["wind_speed_10m_max"][i] or 0),
            "uv": round(float(daily["uv_index_max"][i] or 0), 1),
            "sunrise": (daily["sunrise"][i] or "")[-5:],
            "sunset": (daily["sunset"][i] or "")[-5:],
        })

    # ZIP lookup uses the same postal place as Edit Location & Units. Keep the
    # configured label separate: "Home" is not the name of the forecast city.
    city = ""
    zip_code = str(loc.get("zip") or "").strip()
    if re.fullmatch(r"\d{5}", zip_code):
        try:
            postal = http_json("https://api.zippopotam.us/us/" + zip_code)
            place = (postal.get("places") or [{}])[0]
            city = ", ".join(str(place.get(k) or "").strip()
                             for k in ("place name", "state abbreviation")
                             if str(place.get(k) or "").strip())
        except Exception as e:
            log("weather city lookup failed for ZIP %s: %s" % (zip_code, e))

    return {
        "hi": round(daily["temperature_2m_max"][0]),
        "lo": round(daily["temperature_2m_min"][0]),
        "t": t, "c": c, "p": p, "mm": mm,
        "next": next_hours,
        "loc": {"lat": lat, "lon": lon, "name": loc.get("name") or "",
                "city": city, "zip": zip_code},
        "now": {
            "c": condition(now.get("weathercode"), now.get("is_day", 1)),
            "temp": round(float(now.get("temperature_2m") or 0)),
            "feels": round(float(now.get("apparent_temperature") or 0)),
            "humidity": round(float(now.get("relative_humidity_2m") or 0)),
            "wind": round(float(now.get("wind_speed_10m") or 0)),
            "gust": round(float(now.get("wind_gusts_10m") or 0)),
            "pressure": round(float(now.get("surface_pressure") or 0)),
            "precip": round(float(now.get("precipitation") or 0), 2),
            "code": now.get("weathercode"),
        },
        "days": days,
    }


# ---------------------------------------------------------------- radar
# RainViewer publishes free public radar tiles for personal use; attribution is
# required. Open-Meteo (our forecast source) has no radar at all. The box fetches
# the frame list here so the frame keeps talking only to this server.
RADAR_META_URL = "https://api.rainviewer.com/public/weather-maps.json"
RADAR_TILE_HOST = "https://tilecache.rainviewer.com"
# A wet tile carries tens of thousands of opaque pixels; edges carry a handful.
RADAR_ECHO_MIN = 200
_radar_lock = threading.Lock()
_radar_cache = {"at": 0.0, "doc": None}
_radar_echo_lock = threading.Lock()
_radar_echo_cache = {}

# Labeled geographic context, separate from RainViewer's transparent echoes.
# Fetch only requested viewport tiles; retain them for at least seven days.
BASEMAP_TILE_URL = os.environ.get("BASEMAP_TILE_URL", "https://tile.openstreetmap.org/{z}/{x}/{y}.png")
BASEMAP_CACHE_DIR = os.path.join(DATA_DIR, "basemap_tiles")
BASEMAP_TTL = 7 * 24 * 60 * 60
_basemap_locks = [threading.Lock() for _ in range(32)]
COUNTY_MAP_URL = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/export"


def basemap_tile(z, x, y, referer=None, boundaries=False):
    """Cache geographic tiles persistently; revalidate after expiry."""
    filename = os.path.join(BASEMAP_CACHE_DIR, "%s%d-%d-%d.png" % ("county-" if boundaries else "", z, x, y))
    with _basemap_locks[hash(filename) % len(_basemap_locks)]:
        try:
            with open(filename + ".json", encoding="utf-8") as f:
                meta = json.load(f)
            with open(filename, "rb") as f:
                body = f.read()
        except (OSError, ValueError):
            meta, body = {}, None
        remaining = meta.get("at", 0) + meta.get("ttl", BASEMAP_TTL) - time.time()
        if body is not None and remaining > 0:
            return body, int(remaining)
        headers = {"User-Agent": "FrameDashboard-StartOS/1.2 (+https://github.com/aoeu10)"}
        if referer:
            headers["Referer"] = referer
        if body is not None:
            if meta.get("etag"):
                headers["If-None-Match"] = meta["etag"]
            if meta.get("modified"):
                headers["If-Modified-Since"] = meta["modified"]
        url = BASEMAP_TILE_URL.format(z=z, x=x, y=y)
        if boundaries:
            extent = 20037508.342789244
            span = 2 * extent / (2 ** z)
            bbox = (-extent + x * span, extent - (y + 1) * span,
                    -extent + (x + 1) * span, extent - y * span)
            url = COUNTY_MAP_URL + "?" + urllib.parse.urlencode({
                "bbox": ",".join(str(v) for v in bbox), "bboxSR": 3857,
                "imageSR": 3857, "size": "256,256", "dpi": 96,
                "format": "png32", "transparent": "true", "f": "image",
                # Scale-dependent versions of current state/county layers.
                "layers": "show:" + ",".join(str(i) for i in range(14)),
            })
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                body = response.read()
                response_headers = response.headers
            if not body.startswith(b"\x89PNG\r\n\x1a\n"):
                raise ValueError("basemap response is not PNG")
        except urllib.error.HTTPError as e:
            if e.code != 304 or body is None:
                raise
            response_headers = e.headers
        match = re.search(r"max-age=(\d+)", response_headers.get("Cache-Control", ""))
        ttl = max(BASEMAP_TTL, int(match.group(1))) if match else meta.get("ttl", BASEMAP_TTL)
        meta = {
            "at": time.time(), "ttl": ttl,
            "etag": response_headers.get("ETag", meta.get("etag")),
            "modified": response_headers.get("Last-Modified", meta.get("modified")),
        }
        os.makedirs(BASEMAP_CACHE_DIR, exist_ok=True)
        with open(filename + ".tmp", "wb") as f:
            f.write(body)
        os.replace(filename + ".tmp", filename)
        with open(filename + ".json.tmp", "w", encoding="utf-8") as f:
            json.dump(meta, f)
        os.replace(filename + ".json.tmp", filename + ".json")
        return body, ttl


def radar_meta(lat=None, lon=None):
    """Cache the frame list independently of location-specific echo probes."""
    with _radar_lock:
        cached = _radar_cache["doc"]
        if not cached or time.time() - _radar_cache["at"] >= 240:
            try:
                doc = http_json(RADAR_META_URL)
            except Exception as e:
                log("radar metadata failed: %r" % (e,))
                if not cached:
                    return None
            else:
                frames = []
                for f in ((doc.get("radar") or {}).get("past") or [])[-13:]:
                    token = (f.get("path") or "").rstrip("/").rsplit("/", 1)[-1]
                    if token:
                        frames.append({"time": f.get("time"), "path": token})
                cached = {
                    "tileBase": "/api/radar/tile/",
                    "frames": frames,
                    "generated": doc.get("generated"),
                    "attribution": "RainViewer",
                    "attributionUrl": "https://www.rainviewer.com/",
                }
                _radar_cache.update(at=time.time(), doc=cached)

    # Never mutate the location-independent cached document with echo flags.
    if lat is None or lon is None:
        return cached
    z = 7
    n = 2 ** z
    x = math.floor((lon + 180.0) / 360.0 * n)
    lat_rad = math.radians(max(-85.05112878, min(85.05112878, lat)))
    y = math.floor((1 - math.asinh(math.tan(lat_rad)) / math.pi) / 2 * n)
    frames = []
    for frame in cached["frames"]:
        key = (frame["path"], z, x, y)
        # Coalesce concurrent probes. Immutable frame tokens let subsequent
        # metadata refreshes reuse every overlapping frame's result.
        with _radar_echo_lock:
            if key not in _radar_echo_cache:
                echo = tile_has_echo(*key)
                if echo is not None:
                    if len(_radar_echo_cache) >= 256:
                        del _radar_echo_cache[next(iter(_radar_echo_cache))]
                    _radar_echo_cache[key] = echo
            else:
                echo = _radar_echo_cache[key]
        frames.append(dict(frame, echo=echo))
    return dict(cached, frames=frames)


def tile_has_echo(token, z, x, y):
    """True when the proxied tile carries visible radar returns.

    Counts non-transparent pixels and compares against a threshold: tile edges
    can carry a handful of stray pixels that are invisible on screen, so "any
    pixel" would mislabel a dry area as raining. A genuinely wet tile is tens
    of thousands of pixels.
    """
    url = "%s/v2/radar/%s/256/%s/%s/%s/2/1_1.png" % (RADAR_TILE_HOST, token, z, x, y)
    try:
        with urllib.request.urlopen(url, timeout=15) as r:
            img = Image.open(io.BytesIO(r.read())).convert("RGBA")
        histogram = img.getchannel("A").histogram()
        return sum(histogram[1:]) >= RADAR_ECHO_MIN
    except Exception as e:
        log("radar echo probe failed (%s): %r" % (url, e))
        return None


# ---------------------------------------------------------------- frame doc + sync
NAV_SECTIONS = ("home", "weather", "calendar", "photos", "meals", "school",
                "tasks", "shopping", "vestaboard", "control")
# New optional sections stay off until the household turns them on.
NAV_DEFAULT_HIDDEN = ("meals", "school")


def build_nav(saved):
    """Sidebar sections in the fixed built-in order; Today first and shown.

    Only visibility is configurable. A saved list contributes visibility flags;
    its order is ignored, as are unknown/duplicate entries. An absent or
    unusable setting shows every section except the opt-in Meals and School.
    """
    visible = {key: key not in NAV_DEFAULT_HIDDEN for key in NAV_SECTIONS}
    if isinstance(saved, list) and saved:
        for item in saved:
            if not isinstance(item, dict):
                continue
            key = item.get("section")
            if key not in NAV_SECTIONS:
                continue
            visible[key] = key == "home" or item.get("visible") is not False
    return [{"section": key, "visible": visible[key]} for key in NAV_SECTIONS]


USER_CARDS = ("calendar", "weather", "photos", "chores", "shopping", "home")
DEFAULT_USER_CARDS = ("calendar", "weather", "photos")


def build_shopping(config):
    """Catalog and current list. The frame posts list changes back here."""
    shopping = config.get("shopping") or {}
    catalogs = [shopping]
    defaults = shopping.get("defaults") or {}
    if defaults.get("enabled") is True:
        catalogs.append(defaults)
    stores = []
    for store in shopping.get("stores") or []:
        name = str((store or {}).get("name") or "").strip()
        if name and name not in stores:
            stores.append(name)
    categories = []
    for catalog in catalogs:
        for category in catalog.get("categories") or []:
            name = str(category or "").strip()
            if name and name not in categories:
                categories.append(name)
    # Switching starters off must not recategorize items already on the list.
    if defaults.get("enabled") is not True:
        for entry in shopping.get("list") or []:
            category = str((entry or {}).get("category") or "").strip()
            if category in (defaults.get("categories") or []) and category not in categories:
                categories.append(category)
    if "Other" not in categories:
        categories.append("Other")
    items = []
    seen_names = set()
    for index, catalog in enumerate(catalogs):
        for item in catalog.get("items") or []:
            name = str((item or {}).get("name") or "").strip()
            if not name or (index and name.casefold() in seen_names):
                continue
            seen_names.add(name.casefold())
            category = str(item.get("category") or "").strip()
            items.append({
                "name": name,
                "category": category if category in categories else "Other",
                "store": str(item.get("store") or "").strip(),
                "usual": item.get("usual") is True,
            })
    entries = []
    for entry in shopping.get("list") or []:
        name = str((entry or {}).get("name") or "").strip()
        if not name:
            continue
        category = str(entry.get("category") or "").strip()
        entries.append({
            "name": name,
            "category": category if category in categories else "Other",
            "store": str(entry.get("store") or "").strip(),
            "qty": max(1, int(entry.get("qty") or 1)),
            "note": str(entry.get("note") or ""),
            "done": entry.get("done") is True,
        })
    return {"stores": stores, "categories": categories, "items": items, "list": entries}


def build_users(config):
    """People for the Today presence list, each with a stable route id.

    Calendar references match a configured calendar by name or key. A user's
    ``calendars`` selection is authoritative; when it is empty, calendars
    assigned to that user in Edit Calendars are used. Unknown cards are
    dropped; an empty card list falls back to the default set.
    """
    calendars = config.get("calendars") or []
    by_name = {}
    for i, cal in enumerate(calendars):
        key = "cal%d" % i
        name = cal.get("name") or key
        by_name[key.lower()] = (key, name)
        by_name[str(name).strip().lower()] = (key, name)
    users, seen = [], set()
    for item in config.get("users") or []:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "user"
        uid, n = base, 2
        while uid in seen:
            uid = "%s-%d" % (base, n)
            n += 1
        seen.add(uid)
        requested = item.get("calendars")
        if not isinstance(requested, list):
            requested = [item.get("calendar")] if item.get("calendar") else []
        if not requested:
            requested = [cal.get("name") for cal in calendars
                         if str(cal.get("user") or "").strip().lower() == name.lower()]
        refs = []
        for ref in requested:
            match = by_name.get(str(ref or "").strip().lower())
            if match and match not in refs:
                refs.append(match)
        cards = [c for c in (item.get("cards") or []) if c in USER_CARDS]
        if not cards:
            cards = list(DEFAULT_USER_CARDS)
        users.append({
            "id": uid,
            "name": name,
            "color": item.get("color") if re.fullmatch(r"#[0-9a-fA-F]{6}", str(item.get("color") or "")) else "#111111",
            "calendarKeys": [ref[0] for ref in refs],
            "calendarNames": [ref[1] for ref in refs],
            "cards": cards,
        })
    return users


CHORE_ROUTINES = ("morning", "after", "evening")


def _chore_id(routine, title, used):
    base = "%s-%s" % (routine, re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") or "chore")
    candidate, n = base, 2
    while candidate in used:
        candidate = "%s-%d" % (base, n)
        n += 1
    used.add(candidate)
    return candidate


def build_chores(config):
    """Configured chores, with user assignments resolved to stable route ids.

    An empty or unknown assignee belongs to Anyone. Unknown routines fall back
    to Morning; a blank emoji becomes a checkmark; stars are clamped to 0-10.
    Stored ids are kept unless missing or duplicated, so client completion
    marks survive polls while the configuration is unchanged.
    """
    by_name = {user["name"].casefold(): user["id"] for user in build_users(config)}
    chores, used = [], set()
    for item in config.get("chores") or []:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        if not title:
            continue
        routine = str(item.get("routine") or "")
        if routine not in CHORE_ROUTINES:
            routine = "morning"
        name = str(item.get("user") or "").strip()
        who = by_name.get(name.casefold(), "any") if name else "any"
        emoji = str(item.get("emoji") or "").strip() or "✅"
        try:
            stars = int(item.get("stars"))
        except (TypeError, ValueError):
            stars = 1
        stars = max(0, min(10, stars))
        cid = str(item.get("id") or "").strip()
        if not cid or cid in used:
            cid = _chore_id(routine, title, used)
        else:
            used.add(cid)
        chores.append({"id": cid, "r": routine, "who": who, "title": title,
                       "emoji": emoji, "stars": stars})
    return chores


def build_frame_doc(config, zone):
    night = config.get("night") or {}
    doc = {"ok": True, "generated_at": datetime.now(tz=zone).isoformat(),
           "timezone": zone.key,
           "night": {"dim": bool(night.get("dim", True)), "red": bool(night.get("red", False))},
           "units": {"temperature": (config.get("units", {}).get("temperature", "fahrenheit"))}}
    doc["nav"] = build_nav(config.get("nav"))
    doc["users"] = build_users(config)
    doc["chores"] = build_chores(config)
    doc["shopping"] = build_shopping(config)
    doc["weather"] = sync_weather(config, zone)
    doc["events"], doc["calendars"] = sync_calendars(config, zone)
    doc["school"] = build_school(config, doc["calendars"])
    doc["meals"] = build_meals(config, doc["events"], doc["calendars"], zone)
    doc["photos"], doc["photoAlbums"] = build_album_manifest(config)
    return doc


def run_sync():
    config = get_config()
    tzname = config.get("timezone") or ""
    try:
        zone = zoneinfo.ZoneInfo(tzname or os.environ.get("TZ") or "UTC")
    except (zoneinfo.ZoneInfoNotFoundError, ValueError):
        log("unknown time zone %r; using UTC" % tzname)
        zone = zoneinfo.ZoneInfo("UTC")
    try:
        doc = build_frame_doc(config, zone)
    except Exception as e:
        log("frame doc failed: %r" % (e,))
        return
    doc_path = CACHE_PATH
    tmp = doc_path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(doc, f)
    os.replace(tmp, doc_path)
    log("sync complete: %d events, %d photos, weather=%s" % (
        len(doc.get("events", [])), len(doc.get("photos", [])), bool(doc.get("weather"))))


def config_interval_minutes():
    return max(5, int((get_config().get("syncIntervalMinutes") or 60)))


# ---------------------------------------------------------------- API server
class ApiHandler(BaseHTTPRequestHandler):
    def _json(self, body, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.rstrip("/")
        if path == "/api/frame":
            self._json(open(CACHE_PATH, "rb").read() if os.path.exists(CACHE_PATH) else b'{"ok": false}')
        elif path == "/api/shopping":
            self._json(json.dumps(build_shopping(get_config())).encode())
        elif path == "/api/printer":
            printer = get_config().get("printer") or {}
            self._json(json.dumps({
                "name": str(printer.get("name") or ""),
                "url": str(printer.get("url") or ""),
            }).encode())
        elif path == "/api/printers":
            try:
                subnet = str((get_config().get("printer") or {}).get("scanSubnet") or "").strip() or "192.168.1.0/24"
                self._json(json.dumps({"printers": discover_printers(subnets=[subnet])}).encode())
            except Exception as e:
                log("printer discovery failed: %r" % (e,))
                self._json(json.dumps({"printers": [], "error": str(e)}).encode(), 502)
        elif path == "/api/vestaboard":
            self._vestaboard_status()
        elif path == "/api/radar":
            loc = (get_config().get("location") or {})
            meta = radar_meta(loc.get("lat"), loc.get("lon")) or {"frames": []}
            self._json(json.dumps(meta).encode())
        elif path.startswith("/api/radar/tile/"):
            self._tile(path)
        elif path.startswith(("/api/basemap/", "/api/boundaries/")):
            self._basemap(path)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        path = self.path.rstrip("/")
        if path == "/api/print":
            try:
                length = int(self.headers.get("Content-Length") or 0)
                if length <= 0 or length > 64 * 1024:
                    raise ValueError("bad length")
                json.loads(self.rfile.read(length).decode("utf-8"))
                config = get_config()
                url = str((config.get("printer") or {}).get("url") or "").strip()
                if not url:
                    raise ValueError("Set a printer URL in StartOS → Actions & Config → Printer Settings, then save it.")
                shopping = build_shopping(config)
                zone = None
                try:
                    zone = zoneinfo.ZoneInfo(config.get("timezone") or "UTC")
                except (zoneinfo.ZoneInfoNotFoundError, ValueError):
                    zone = zoneinfo.ZoneInfo("UTC")
                pdf = build_groceries_pdf(shopping, zone)
                job_id = print_pdf(url, pdf, "Groceries %s" % datetime.now(tz=zone).strftime("%Y-%m-%d"))
                log("groceries printed to %s (job %s)" % (url, job_id))
                self._json(json.dumps({"ok": True, "jobId": job_id, "printer": url}).encode())
            except Exception as e:
                log("groceries print failed: %r" % (e,))
                self._json(json.dumps({"ok": False, "error": str(e)}).encode(), 502)
            return
        if path == "/api/vestaboard/compose":
            self._vestaboard_compose()
            return
        if path == "/api/vestaboard/message":
            self._vestaboard_message()
            return
        if path != "/api/shopping/list":
            self.send_response(404)
            self.end_headers()
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
            if length <= 0 or length > 256 * 1024:
                raise ValueError("bad length")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            entries = payload.get("list")
            if not isinstance(entries, list):
                raise ValueError("list must be an array")
        except Exception as e:
            log("shopping list rejected: %r" % (e,))
            self.send_response(400)
            self.end_headers()
            return
        # Merge into config.json under the same shape the actions use, so the
        # catalog and every other setting survive a list change.
        with _cfg_lock:
            try:
                with open(CONFIG_PATH, encoding="utf-8") as f:
                    config = json.load(f)
            except Exception as e:
                log("shopping write failed to read config: %r" % (e,))
                self.send_response(500)
                self.end_headers()
                return
            shopping = config.get("shopping") or {}
            shopping["list"] = entries
            config["shopping"] = shopping
            tmp = CONFIG_PATH + ".tmp"
            try:
                with open(tmp, "w", encoding="utf-8") as f:
                    json.dump(config, f)
                os.replace(tmp, CONFIG_PATH)
            except Exception as e:
                log("shopping write failed: %r" % (e,))
                self.send_response(500)
                self.end_headers()
                return
            _cfg["mtime"] = -1
        self._json(json.dumps(build_shopping(get_config())).encode())

    def _vestaboard_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 64 * 1024:
            raise ValueError("Request body is too large.")
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            raise ValueError("Request body must be JSON.")
        if not isinstance(payload, dict):
            raise ValueError("Request body must be a JSON object.")
        return payload

    def _vestaboard_error(self, error):
        code = 502 if getattr(error, "status", None) else 400
        self._json(json.dumps({"ok": False, "error": str(error)}).encode(), code)

    def _vestaboard_status(self):
        config = get_config()
        result = vestaboard.public_settings(config)
        if result["configured"]:
            try:
                result["reachable"] = True
                result["message"] = vestaboard.read_message(config)
            except vestaboard.VestaboardError as error:
                result["reachable"] = False
                result["error"] = str(error)
                log("vestaboard status failed: %s" % error)
            except Exception as error:
                result["reachable"] = False
                result["error"] = "Vestaboard request failed: %s" % error
                log("vestaboard status failed: %r" % (error,))
        else:
            result["reachable"] = False
        self._json(json.dumps(result).encode())

    def _vestaboard_compose(self):
        try:
            payload = self._vestaboard_body()
            current = vestaboard.settings(get_config())
            matrix = vestaboard.compose_vbml(payload.get("vbml"),
                                             current["rows"], current["cols"])
            self._json(json.dumps({"ok": True, "characters": matrix}).encode())
        except vestaboard.VestaboardError as error:
            self._vestaboard_error(error)
        except Exception as error:
            self._vestaboard_error(vestaboard.VestaboardError(str(error)))

    def _vestaboard_message(self):
        try:
            payload = self._vestaboard_body()
            config = get_config()
            current = vestaboard.settings(config)
            if "vbml" in payload:
                matrix = vestaboard.compose_vbml(payload["vbml"],
                                                 current["rows"], current["cols"])
            elif "characters" in payload:
                matrix = vestaboard.validate_matrix(payload["characters"],
                                                     current["rows"], current["cols"])
            else:
                raise vestaboard.VestaboardError(
                    "Send either a characters matrix or a VBML payload.")
            vestaboard.send_message(config, matrix)
            self._json(json.dumps({"ok": True, "characters": matrix}).encode())
        except vestaboard.VestaboardError as error:
            log("vestaboard send failed: %s" % error)
            self._vestaboard_error(error)
        except Exception as error:
            log("vestaboard send failed: %r" % (error,))
            self._vestaboard_error(vestaboard.VestaboardError(str(error)))

    def _basemap(self, path):
        match = re.fullmatch(r"/api/(basemap|boundaries)/(\d{1,2})/(\d{1,4})/(\d{1,4})", path)
        if not match:
            self.send_error(400)
            return
        z, x, y = map(int, match.groups()[1:])
        if not (7 <= z <= 10 and 0 <= x < 2 ** z and 0 <= y < 2 ** z):
            self.send_error(400)
            return
        try:
            body, ttl = basemap_tile(z, x, y, self.headers.get("Referer"), match.group(1) == "boundaries")
        except Exception as e:
            log("basemap tile failed: %r" % (e,))
            self.send_error(502)
            return
        self.send_response(200)
        self.send_header("Content-Type", "image/png")
        self.send_header("Cache-Control", "public, max-age=%d" % ttl)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _tile(self, path):
        """Proxy one RainViewer tile.

        Android 6 has no ISRG Root X1, so tilecache.rainviewer.com fails on the
        frame even though it works in a desktop browser. Serving the bytes from
        the box keeps the frame on one origin and matches the README's promise
        that the frame only talks to this server.
        """
        parts = path[len("/api/radar/tile/"):].split("/")
        # <frame>/<z>/<x>/<y>  (frame path is a hex token from the metadata)
        if len(parts) != 4 or not all(re.fullmatch(r"[A-Za-z0-9_-]+", p) for p in parts):
            self.send_response(400)
            self.end_headers()
            return
        frame, z, x, y = parts
        url = "%s/v2/radar/%s/256/%s/%s/%s/2/1_1.png" % (RADAR_TILE_HOST, frame, z, x, y)
        try:
            with urllib.request.urlopen(url, timeout=15) as r:
                body = r.read()
        except Exception as e:
            log("radar tile failed (%s): %r" % (url, e))
            self.send_response(502)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Type", "image/png")
        # Frames are immutable once published; the token changes every 5 min.
        self.send_header("Cache-Control", "public, max-age=600")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass


# ---------------------------------------------------------------- main
def main():
    log("service starting (pid %d)" % os.getpid())
    # nginx is launched by start.py (the container entrypoint) — this process
    # only serves /api and runs the sync loop.

    server = ThreadingHTTPServer(("127.0.0.1", 8080), ApiHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    log("api listening on 127.0.0.1:8080")

    interval = config_interval_minutes()
    last_config_mtime = None
    next_sync = 0.0  # sync immediately on boot
    while True:
        now = time.time()
        cfg_mtime = None
        try:
            cfg_mtime = os.stat(CONFIG_PATH).st_mtime
        except OSError:
            pass
        sync_now = os.path.exists(SYNC_FLAG_PATH)
        if sync_now:
            try:
                os.remove(SYNC_FLAG_PATH)
            except OSError:
                pass
        cfg_changed = last_config_mtime is not None and cfg_mtime != last_config_mtime
        last_config_mtime = cfg_mtime
        if now >= next_sync or sync_now or cfg_changed:
            try:
                run_sync()
            except Exception as e:
                log("sync crashed: %r" % (e,))
            interval = config_interval_minutes()
            next_sync = time.time() + interval * 60
        time.sleep(10)


if __name__ == "__main__":
    main()
