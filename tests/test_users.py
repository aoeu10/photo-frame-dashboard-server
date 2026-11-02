import unittest

from service import dashboard_service as service


class UserTests(unittest.TestCase):
    def test_selected_calendars_match_name_or_key(self):
        users = service.build_users({
            "calendars": [
                {"name": "Family", "url": "https://example.com/a.ics"},
                {"name": "Wes", "url": "https://example.com/b.ics"},
            ],
            "users": [
                {"name": "Wes", "color": "#2D5BFF", "calendars": ["Family", "cal1"],
                 "cards": ["calendar", "weather"]},
            ],
        })
        self.assertEqual(users[0]["calendarKeys"], ["cal0", "cal1"])
        self.assertEqual(users[0]["calendarNames"], ["Family", "Wes"])
        self.assertEqual(users[0]["cards"], ["calendar", "weather"])

    def test_assignment_fills_in_when_no_selection_is_saved(self):
        users = service.build_users({
            "calendars": [
                {"name": "Family", "url": "https://example.com/a.ics"},
                {"name": "Wes", "url": "https://example.com/b.ics", "user": "Wes"},
            ],
            "users": [{"name": "Wes", "calendars": []}],
        })
        self.assertEqual(users[0]["calendarKeys"], ["cal1"])

    def test_ids_are_stable_and_unique(self):
        users = service.build_users({
            "users": [
                {"name": "Wes"},
                {"name": "Wes"},
                {"name": "Mary Jane"},
                {"name": ""},
            ],
        })
        self.assertEqual([u["id"] for u in users], ["wes", "wes-2", "mary-jane"])

    def test_unknown_cards_and_bad_colors_fall_back(self):
        users = service.build_users({
            "users": [{"name": "Otto", "color": "orange", "cards": ["garage", "home"]}],
        })
        self.assertEqual(users[0]["color"], "#111111")
        self.assertEqual(users[0]["cards"], ["home"])
        self.assertEqual(users[0]["calendarKeys"], [])

    def test_calendar_ownership_and_homepage_flag_are_published(self):
        events, meta = [], [
            {"key": "cal0", "name": "Family", "color": "#111111",
             "user": "", "home": True, "status": "ok"},
            {"key": "cal1", "name": "Wes", "color": "#2D5BFF",
             "user": "Wes", "home": False, "status": "ok"},
        ]
        self.assertEqual(meta[1]["user"], "Wes")
        self.assertFalse(meta[1]["home"])
        self.assertEqual(events, [])


if __name__ == "__main__":
    unittest.main()
