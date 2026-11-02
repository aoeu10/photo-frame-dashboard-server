import unittest

from service import dashboard_service as service


class ChoreTests(unittest.TestCase):
    def test_assignments_resolve_to_user_ids_or_anyone(self):
        chores = service.build_chores({
            "users": [{"name": "Wes"}, {"name": "Mary Jane"}],
            "chores": [
                {"title": "Make bed", "routine": "morning", "user": "Wes", "stars": 1},
                {"title": "Feed dog", "routine": "morning", "user": "", "stars": 2},
                {"title": "Homework", "routine": "after", "user": "mary jane"},
                {"title": "Old", "routine": "after", "user": "Gone"},
            ],
        })
        self.assertEqual([c["who"] for c in chores], ["wes", "any", "mary-jane", "any"])

    def test_normalizes_routine_emoji_stars_and_titles(self):
        chores = service.build_chores({"chores": [
            {"title": "  Make bed ", "routine": "noon", "emoji": "", "stars": 99},
            {"title": "", "routine": "evening"},
            {"title": "Read", "routine": "evening", "emoji": "📖", "stars": "2"},
        ]})
        self.assertEqual(len(chores), 2)
        self.assertEqual(chores[0]["r"], "morning")
        self.assertEqual(chores[0]["emoji"], "✅")
        self.assertEqual(chores[0]["stars"], 10)
        self.assertEqual(chores[1]["stars"], 2)
        self.assertTrue(chores[0]["id"].startswith("morning-"))

    def test_ids_stay_unique_and_stored_ids_are_kept(self):
        chores = service.build_chores({"chores": [
            {"id": "keep", "title": "Make bed", "routine": "morning"},
            {"id": "keep", "title": "Make bed", "routine": "morning"},
            {"title": "Make bed", "routine": "morning"},
        ]})
        self.assertEqual(len({c["id"] for c in chores}), 3)
        self.assertEqual(chores[0]["id"], "keep")

    def test_absent_chores_are_empty(self):
        self.assertEqual(service.build_chores({}), [])


if __name__ == "__main__":
    unittest.main()
