import unittest
import json
from app import app, get_db

class TestExpenseTrackerAPI(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_1_get_categories(self):
        response = self.client.get("/api/categories")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn("categories", data)
        self.assertGreater(len(data["categories"]), 0)
        print(f"✓ Categories retrieved: {len(data['categories'])} categories found")

    def test_2_add_expense(self):
        payload = {
            "amount": 25.50,
            "type": "expense",
            "category_id": 1,  # Food & Dining
            "date": "2026-10-12",
            "description": "Lunch with teammates"
        }
        response = self.client.post(
            "/api/transactions",
            data=json.dumps(payload),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 201)
        data = response.get_json()
        self.assertEqual(data["transaction"]["amount"], 25.50)
        self.assertEqual(data["transaction"]["type"], "expense")
        print(f"✓ Expense logged successfully (ID: {data['transaction']['id']})")

    def test_3_add_income(self):
        payload = {
            "amount": 3500.00,
            "type": "income",
            "category_id": 10, # Salary
            "date": "2026-10-12",
            "description": "Monthly Salary"
        }
        response = self.client.post(
            "/api/transactions",
            data=json.dumps(payload),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 201)
        data = response.get_json()
        self.assertEqual(data["transaction"]["amount"], 3500.00)
        self.assertEqual(data["transaction"]["type"], "income")
        print(f"✓ Income logged successfully (ID: {data['transaction']['id']})")

    def test_4_validation_rejection(self):
        # Invalid amount
        resp_invalid_amount = self.client.post(
            "/api/transactions",
            data=json.dumps({"amount": -10, "type": "expense"}),
            content_type="application/json"
        )
        self.assertEqual(resp_invalid_amount.status_code, 400)

        # Invalid type
        resp_invalid_type = self.client.post(
            "/api/transactions",
            data=json.dumps({"amount": 10, "type": "crypto"}),
            content_type="application/json"
        )
        self.assertEqual(resp_invalid_type.status_code, 400)
        print("✓ Input validations correctly rejected invalid requests")

    def test_5_get_summary(self):
        response = self.client.get("/api/summary?month=2026-10")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn("total_income", data)
        self.assertIn("total_expense", data)
        self.assertIn("net_balance", data)
        self.assertIn("category_breakdown", data)
        print(f"✓ Monthly summary: Income=\${data['total_income']}, Expense=\${data['total_expense']}, Balance=\${data['net_balance']}")

    def test_6_delete_transaction(self):
        # First add one to delete
        res = self.client.post(
            "/api/transactions",
            data=json.dumps({"amount": 15.0, "type": "expense", "date": "2026-10-12", "description": "Temp coffee"}),
            content_type="application/json"
        )
        tx_id = res.get_json()["transaction"]["id"]
        
        # Now delete it
        del_res = self.client.delete(f"/api/transactions/{tx_id}")
        self.assertEqual(del_res.status_code, 200)
        print(f"✓ Transaction {tx_id} deleted successfully")

if __name__ == "__main__":
    unittest.main(verbosity=2)
