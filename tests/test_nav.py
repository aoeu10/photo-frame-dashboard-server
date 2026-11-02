import unittest

from service import dashboard_service as service

HIDDEN_BY_DEFAULT = {"meals", "school"}


class SidebarTests(unittest.TestCase):
    def test_absent_setting_keeps_the_built_in_order(self):
        self.assertEqual(
            service.build_nav(None),
            [
                {"section": key, "visible": key not in HIDDEN_BY_DEFAULT}
                for key in service.NAV_SECTIONS
            ],
        )

    def test_saved_visibility_applies_without_changing_the_fixed_order(self):
        self.assertEqual(
            service.build_nav([
                {"section": "photos", "visible": True},
                {"section": "home", "visible": False},
                {"section": "calendar", "visible": False},
                {"section": "meals", "visible": True},
            ]),
            [
                {"section": "home", "visible": True},
                {"section": "weather", "visible": True},
                {"section": "calendar", "visible": False},
                {"section": "photos", "visible": True},
                {"section": "meals", "visible": True},
                {"section": "school", "visible": False},
                {"section": "tasks", "visible": True},
                {"section": "shopping", "visible": True},
                {"section": "vestaboard", "visible": True},
                {"section": "control", "visible": True},
            ],
        )

    def test_unknown_entries_are_ignored_and_today_is_never_hidden(self):
        self.assertEqual(
            service.build_nav([
                {"section": "weather", "visible": False},
                {"section": "garage", "visible": True},
                "calendar",
            ]),
            [
                {"section": key, "visible": key != "weather" and key not in HIDDEN_BY_DEFAULT}
                for key in service.NAV_SECTIONS
            ],
        )


if __name__ == "__main__":
    unittest.main()
