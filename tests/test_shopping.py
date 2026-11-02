import unittest

from service import dashboard_service as service


class ShoppingTests(unittest.TestCase):
    def test_catalog_and_list_are_normalized(self):
        shopping = service.build_shopping({
            "shopping": {
                "stores": [{"name": "FreshCo"}, {"name": "Costco"}, {"name": "FreshCo"}],
                "categories": ["Produce", "Dairy"],
                "items": [
                    {"name": "Bananas", "category": "Produce", "store": "FreshCo", "usual": True},
                    {"name": "Milk", "category": "Bakery", "store": "Costco"},
                    {"name": "", "category": "Produce"},
                ],
                "list": [
                    {"name": "Bananas", "category": "Produce", "store": "FreshCo", "qty": 0},
                    {"name": "Eggs", "category": "Nope", "qty": 2, "done": True},
                ],
            },
        })
        self.assertEqual(shopping["stores"], ["FreshCo", "Costco"])
        self.assertEqual(shopping["categories"], ["Produce", "Dairy", "Other"])
        self.assertEqual(len(shopping["items"]), 2)
        self.assertEqual(shopping["items"][0]["usual"], True)
        self.assertEqual(shopping["items"][1]["category"], "Other")
        self.assertEqual(shopping["list"][0]["qty"], 1)
        self.assertEqual(shopping["list"][1]["category"], "Other")
        self.assertEqual(shopping["list"][1]["done"], True)

    def test_optional_defaults_yield_to_custom_items_without_clearing_the_list(self):
        config = {"shopping": {
            "categories": ["My groceries"],
            "items": [{"name": "milk", "category": "My groceries", "store": "Local", "usual": True}],
            "list": [{"name": "Bread", "category": "Dairy", "store": "Local", "qty": 2}],
            "defaults": {
                "enabled": True,
                "categories": ["Dairy", "Produce"],
                "items": [
                    {"name": "Milk", "category": "Dairy"},
                    {"name": "Apples", "category": "Produce"},
                ],
            },
        }}
        enabled = service.build_shopping(config)
        self.assertEqual(enabled["items"], [
            {"name": "milk", "category": "My groceries", "store": "Local", "usual": True},
            {"name": "Apples", "category": "Produce", "store": "", "usual": False},
        ])
        self.assertEqual(enabled["categories"], ["My groceries", "Dairy", "Produce", "Other"])
        config["shopping"]["defaults"]["enabled"] = False
        disabled = service.build_shopping(config)
        self.assertEqual(disabled["items"], enabled["items"][:1])
        self.assertEqual(disabled["categories"], ["My groceries", "Dairy", "Other"])
        self.assertEqual(disabled["list"], [
            {"name": "Bread", "category": "Dairy", "store": "Local", "qty": 2, "note": "", "done": False},
        ])

    def test_absent_shopping_config_yields_empty_sections(self):
        self.assertEqual(
            service.build_shopping({}),
            {"stores": [], "categories": ["Other"], "items": [], "list": []},
        )


if __name__ == "__main__":
    unittest.main()
