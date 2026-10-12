import sqlite3
import os

DB_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(DB_DIR, "expenses.db")
SCHEMA_PATH = os.path.join(DB_DIR, "schema.sql")

DEFAULT_CATEGORIES = [
    # Expenses
    ("Food & Dining", "expense", "utensils", "#EF4444"),
    ("Groceries", "expense", "shopping-cart", "#F97316"),
    ("Transportation", "expense", "car", "#F59E0B"),
    ("Housing & Rent", "expense", "home", "#84CC16"),
    ("Utilities & Bills", "expense", "zap", "#10B981"),
    ("Entertainment", "expense", "film", "#06B6D4"),
    ("Shopping", "expense", "bag", "#8B5CF6"),
    ("Healthcare", "expense", "heart-pulse", "#EC4899"),
    ("Other Expense", "expense", "more-horizontal", "#6B7280"),
    # Income
    ("Salary", "income", "briefcase", "#10B981"),
    ("Freelance & Side Gig", "income", "laptop", "#3B82F6"),
    ("Investments", "income", "trending-up", "#6366F1"),
    ("Gifts & Allowance", "income", "gift", "#A855F7"),
    ("Other Income", "income", "dollar-sign", "#059669"),
]

def init_db():
    print(f"Connecting to database at: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")

    # Read and execute schema
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema_sql = f.read()
    cursor.executescript(schema_sql)
    print("✓ Schema initialized successfully.")

    # Seed default categories if none exist
    cursor.execute("SELECT COUNT(*) FROM categories")
    count = cursor.fetchone()[0]
    if count == 0:
        cursor.executemany(
            """
            INSERT INTO categories (name, type, icon, color)
            VALUES (?, ?, ?, ?)
            """,
            DEFAULT_CATEGORIES,
        )
        conn.commit()
        print(f"✓ Seeded {len(DEFAULT_CATEGORIES)} default categories.")
    else:
        print(f"Categories already exist ({count} found). Skipping seeding.")

    conn.close()

if __name__ == "__main__":
    init_db()
