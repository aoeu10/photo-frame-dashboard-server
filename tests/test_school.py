import unittest

from service import dashboard_service as service

CALENDAR_META = [
    {"key": "cal0", "name": "Family", "color": "#111111", "status": "ok"},
    {"key": "cal1", "name": "Lincoln", "color": "#1E88E5", "status": "ok"},
    {"key": "cal2", "name": "Kitchen", "color": "#FB8C00", "status": "unavailable"},
]

CONFIG = {
    "users": [{"name": "Dad"}, {"name": "John"}],
    "calendars": [
        {"name": "Family", "url": "https://example.test/f.ics", "color": "#111111"},
        {"name": "Lincoln", "url": "https://example.test/l.ics", "color": "#1E88E5", "school": True},
        {"name": "Kitchen", "url": "https://example.test/k.ics", "color": "#FB8C00", "meal": True},
    ],
}


class SchoolTests(unittest.TestCase):
    def test_only_school_flagged_calendars_are_published(self):
        school = service.build_school(CONFIG, CALENDAR_META)
        self.assertEqual(school["keys"], ["cal1"])
        self.assertEqual(
            [(c["key"], c["name"], c["color"], c["status"]) for c in school["calendars"]],
            [("cal1", "Lincoln", "#1E88E5", "ok")],
        )

    def test_unavailable_school_calendar_keeps_metadata_and_status(self):
        calendars = [dict(c, school=False) for c in CONFIG["calendars"]]
        calendars[2] = dict(calendars[2], school=True)
        school = service.build_school({"calendars": calendars}, CALENDAR_META)
        self.assertEqual(school["keys"], ["cal2"])
        self.assertEqual(school["calendars"][0]["status"], "unavailable")

    def test_no_school_flag_yields_empty_metadata(self):
        config = {"calendars": [CONFIG["calendars"][0]]}
        self.assertEqual(service.build_school(config, CALENDAR_META),
                         {"keys": [], "calendars": []})

    def test_personal_pages_follow_the_usual_calendar_selection(self):
        users = {u["name"]: u for u in service.build_users(CONFIG)}
        self.assertEqual(users["John"]["calendarKeys"], [])
        config = dict(CONFIG, users=[
            {"name": "John", "calendars": ["Lincoln"]},
            {"name": "Dad", "calendars": ["Family"]},
        ])
        users = {u["name"]: u for u in service.build_users(config)}
        self.assertEqual(users["John"]["calendarKeys"], ["cal1"])
        self.assertEqual(users["John"]["calendarNames"], ["Lincoln"])
        self.assertEqual(users["Dad"]["calendarKeys"], ["cal0"])


if __name__ == "__main__":
    unittest.main()
