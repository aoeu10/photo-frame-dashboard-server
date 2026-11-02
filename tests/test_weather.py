import unittest
from unittest.mock import patch

from service import dashboard_service as service


def forecast(is_day_hour=0):
    return {
        "current": {
            "time": "2026-10-21T22:00",
            "temperature_2m": 55,
            "weathercode": 0,
            "precipitation": 0,
            "is_day": is_day_hour,
        },
        "hourly": {
            "time": ["2026-10-21T%02d:00" % hour for hour in range(24)],
            "temperature_2m": [55] * 24,
            "weathercode": [0] * 24,
            "precipitation_probability": [0] * 24,
            "precipitation": [0] * 24,
            "is_day": [0 if hour >= 20 or hour < 6 else 1 for hour in range(24)],
        },
        "daily": {
            "time": ["2026-10-21"],
            "weathercode": [0],
            "temperature_2m_max": [70],
            "temperature_2m_min": [40],
            "precipitation_probability_max": [0],
            "wind_speed_10m_max": [5],
            "uv_index_max": [3],
            "sunrise": ["2026-10-21T07:30"],
            "sunset": ["2026-10-21T18:20"],
        },
    }


class NightConditionTests(unittest.TestCase):
    def sync(self, doc):
        config = {
            "location": {"lat": 43.6150, "lon": -116.2023},
            "timezone": "America/Chicago",
        }
        with patch.object(service, "http_json", return_value=doc):
            return service.sync_weather(config, service.zoneinfo.ZoneInfo("America/Chicago"))

    def test_clear_night_is_not_labelled_sunny(self):
        weather = self.sync(forecast(is_day_hour=0))
        self.assertEqual(weather["now"]["c"], "moon")
        self.assertEqual(weather["c"][22], "moon")
        self.assertEqual(weather["next"][0]["c"], "moon")

    def test_clear_day_stays_sunny(self):
        weather = self.sync(forecast(is_day_hour=1))
        self.assertEqual(weather["now"]["c"], "sun")
        self.assertEqual(weather["c"][12], "sun")

    def test_night_does_not_change_rain(self):
        doc = forecast(is_day_hour=0)
        doc["current"]["weathercode"] = 61
        doc["hourly"]["weathercode"] = [61] * 24
        weather = self.sync(doc)
        self.assertEqual(weather["now"]["c"], "rain")
        self.assertEqual(weather["c"][22], "rain")


if __name__ == "__main__":
    unittest.main()
