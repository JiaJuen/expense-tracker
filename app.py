import os
import sqlite3
from datetime import datetime
from flask import Flask, jsonify, request, render_template

from database.setup_db import init_db

app = Flask(__name__)

DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "database")
DB_PATH = os.path.join(DB_DIR, "expenses.db")

# Ensure DB and tables exist on startup
init_db()

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "timestamp": datetime.now().isoformat()})

@app.route("/api/categories", methods=["GET"])
def get_categories():
    cat_type = request.args.get("type")
    conn = get_db()
    if cat_type:
        cursor = conn.execute(
            "SELECT id, name, type, icon, color FROM categories WHERE type = ? ORDER BY name ASC",
            (cat_type,),
        )
    else:
        cursor = conn.execute(
            "SELECT id, name, type, icon, color FROM categories ORDER BY type ASC, name ASC"
        )
    categories = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({"categories": categories})

@app.route("/api/transactions", methods=["GET"])
def get_transactions():
    month = request.args.get("month")  # Expected format: YYYY-MM
    tx_type = request.args.get("type")
    category_id = request.args.get("category_id")

    query = """
        SELECT 
            t.id, t.amount, t.type, t.category_id, t.date, t.description, t.created_at,
            c.name AS category_name, c.icon AS category_icon, c.color AS category_color
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE 1=1
    """
    params = []

    if month:
        query += " AND strftime('%Y-%m', t.date) = ?"
        params.append(month)
    if tx_type:
        query += " AND t.type = ?"
        params.append(tx_type)
    if category_id:
        query += " AND t.category_id = ?"
        params.append(category_id)

    query += " ORDER BY t.date DESC, t.id DESC"

    conn = get_db()
    cursor = conn.execute(query, params)
    transactions = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify({"transactions": transactions, "count": len(transactions)})

@app.route("/api/transactions", methods=["POST"])
def add_transaction():
    data = request.get_json() or {}

    # Validation
    try:
        amount = float(data.get("amount", 0))
        if amount <= 0:
            return jsonify({"error": "Amount must be greater than 0"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid amount"}), 400

    tx_type = data.get("type", "").lower()
    if tx_type not in ("expense", "income"):
        return jsonify({"error": "Type must be either 'expense' or 'income'"}), 400

    category_id = data.get("category_id")
    date_str = data.get("date")
    if not date_str:
        date_str = datetime.today().strftime("%Y-%m-%d")
    else:
        try:
            datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            return jsonify({"error": "Invalid date format. Expected YYYY-MM-DD"}), 400

    description = (data.get("description") or "").strip()

    conn = get_db()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO transactions (amount, type, category_id, date, description)
            VALUES (?, ?, ?, ?, ?)
            """,
            (amount, tx_type, category_id, date_str, description),
        )
        tx_id = cursor.lastrowid
        conn.commit()

        # Fetch inserted transaction with category details
        row = conn.execute(
            """
            SELECT 
                t.id, t.amount, t.type, t.category_id, t.date, t.description, t.created_at,
                c.name AS category_name, c.icon AS category_icon, c.color AS category_color
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.id = ?
            """,
            (tx_id,),
        ).fetchone()

        result = dict(row) if row else None
        conn.close()
        return jsonify({"message": "Transaction added successfully", "transaction": result}), 201
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 500

@app.route("/api/transactions/<int:tx_id>", methods=["DELETE"])
def delete_transaction(tx_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM transactions WHERE id = ?", (tx_id,))
    changes = conn.total_changes
    conn.commit()
    conn.close()

    if changes == 0:
        return jsonify({"error": "Transaction not found"}), 404

    return jsonify({"message": "Transaction deleted successfully", "id": tx_id})

@app.route("/api/summary", methods=["GET"])
def get_summary():
    # If month is provided as YYYY-MM, filter by it. Default to current month.
    month = request.args.get("month")
    if not month or month == "current":
        month = datetime.today().strftime("%Y-%m")

    conn = get_db()

    # Total Income and Expense for the specified month
    totals_query = """
        SELECT 
            type,
            COALESCE(SUM(amount), 0) AS total
        FROM transactions
        WHERE strftime('%Y-%m', date) = ?
        GROUP BY type
    """
    totals_cursor = conn.execute(totals_query, (month,))
    totals_map = {row["type"]: float(row["total"]) for row in totals_cursor.fetchall()}
    total_income = totals_map.get("income", 0.0)
    total_expense = totals_map.get("expense", 0.0)
    net_balance = total_income - total_expense

    # Breakdown by category for expenses
    cat_query = """
        SELECT 
            COALESCE(c.name, 'Uncategorized') AS category_name,
            COALESCE(c.color, '#9CA3AF') AS color,
            COALESCE(c.icon, 'tag') AS icon,
            SUM(t.amount) AS total
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE strftime('%Y-%m', t.date) = ? AND t.type = 'expense'
        GROUP BY t.category_id
        ORDER BY total DESC
    """
    cat_cursor = conn.execute(cat_query, (month,))
    category_breakdown = []
    for row in cat_cursor.fetchall():
        cat_total = float(row["total"])
        pct = (cat_total / total_expense * 100) if total_expense > 0 else 0
        category_breakdown.append({
            "name": row["category_name"],
            "color": row["color"],
            "icon": row["icon"],
            "total": cat_total,
            "percentage": round(pct, 1)
        })

    # Available months list for dropdown selector
    months_cursor = conn.execute(
        """
        SELECT DISTINCT strftime('%Y-%m', date) AS month_str
        FROM transactions
        ORDER BY month_str DESC
        """
    )
    available_months = [row["month_str"] for row in months_cursor.fetchall() if row["month_str"]]
    if month not in available_months:
        available_months.insert(0, month)

    conn.close()

    return jsonify({
        "month": month,
        "total_income": round(total_income, 2),
        "total_expense": round(total_expense, 2),
        "net_balance": round(net_balance, 2),
        "savings_rate": round((net_balance / total_income * 100) if total_income > 0 else 0, 1),
        "category_breakdown": category_breakdown,
        "available_months": available_months
    })

if __name__ == "__main__":
    # Host on 0.0.0.0 so phone can connect on local Wi-Fi
    print("Starting Flask server on http://localhost:5000 ...")
    app.run(host="0.0.0.0", port=5000, debug=True)
