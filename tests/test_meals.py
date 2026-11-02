import unittest
from datetime import datetime, timedelta

from service import dashboard_service as service

ZONE = service.zoneinfo.ZoneInfo("America/Chicago")

CONFIG = {
    "calendars": [
        {"name": "Family", "url": "https://example.test/f.ics"},
        {"name": "Kitchen", "url": "https://example.test/k.ics", "meal": True},
    ]
}

CALENDAR_META = [
    {"key": "cal0", "name": "Family", "color": "#111111", "status": "ok"},
    {"key": "cal1", "name": "Kitchen", "color": "#FB8C00", "status": "ok"},
]


def event(title, start, people=("cal1",), all_day=False):
    return {
        "uid": title,
        "title": title,
        "start": start.isoformat(),
        "end": (start + timedelta(minutes=30)).isoformat(),
        "allDay": all_day,
        "people": list(people),
    }


class MealTests(unittest.TestCase):
    def setUp(self):
        self.today = datetime.now(tz=ZONE).date()
        self.day = self.today.isoformat()
        self.tomorrow = (self.today + timedelta(days=1)).isoformat()

        def at(hour, minute=0, day=0):
            return datetime.combine(self.today + timedelta(days=day),
                                    datetime.min.time(),
                                    tzinfo=ZONE) + timedelta(hours=hour, minutes=minute)

        self.events = [
            event("Pancakes", at(7, 30)),
            event("Yogurt", at(8, 59)),
            event("Too late for breakfast", at(9)),
            event("Sandwiches", at(11)),
            event("Soup", at(12, 59)),
            event("Too late for lunch", at(13)),
            event("Tacos", at(17)),
            event("Pasta", at(18, 59)),
            event("Too late for dinner", at(19)),
            event("School holiday", at(0), all_day=True),
            event("Roast", at(18, day=1)),
            event("Next week", at(8, day=8)),
            event("Family dinner", at(18), people=("cal0",)),
        ]

    def test_meal_flagged_calendar_entries_are_bucketed_by_start_time(self):
        meals = service.build_meals(CONFIG, self.events, CALENDAR_META, ZONE)
        self.assertEqual(meals["status"], "ok")
        self.assertEqual(meals["keys"], ["cal1"])
        self.assertEqual(meals["name"], "Kitchen")
        self.assertEqual(
            [(i["date"], i["slot"], i["title"]) for i in meals["items"]],
            [
                (self.day, "breakfast", "Pancakes"),
                (self.day, "breakfast", "Yogurt"),
                (self.day, "lunch", "Sandwiches"),
                (self.day, "lunch", "Soup"),
                (self.day, "dinner", "Tacos"),
                (self.day, "dinner", "Pasta"),
                (self.tomorrow, "dinner", "Roast"),
            ],
        )

    def test_no_meal_calendar_turns_meals_off(self):
        config = {"calendars": [CONFIG["calendars"][0]]}
        self.assertEqual(
            service.build_meals(config, self.events, CALENDAR_META, ZONE),
            {"status": "off", "name": "", "keys": [], "calendars": [], "items": []},
        )

    def test_all_meal_calendars_unavailable_reports_unavailable(self):
        meta = [dict(CALENDAR_META[1], status="unavailable")]
        meals = service.build_meals(CONFIG, [], meta, ZONE)
        self.assertEqual(meals["status"], "unavailable")
        self.assertEqual(meals["items"], [])

    def test_events_from_other_calendars_are_ignored(self):
        meals = service.build_meals(CONFIG, [self.events[-1]], CALENDAR_META, ZONE)
        self.assertEqual(meals["items"], [])


if __name__ == "__main__":
    unittest.main()
