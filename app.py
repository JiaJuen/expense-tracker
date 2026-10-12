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

    # Budget calculation
    b_cursor = conn.execute("SELECT amount FROM budgets WHERE month = ?", (month,))
    b_row = b_cursor.fetchone()
    budget_amount = float(b_row["amount"]) if b_row else 1500.00
    budget_used_pct = round((total_expense / budget_amount * 100), 1) if budget_amount > 0 else 0
    budget_remaining = round(max(0, budget_amount - total_expense), 2)

    # Dynamic Financial Insight generator
    savings_rate = round((net_balance / total_income * 100) if total_income > 0 else 0, 1)
    if total_expense == 0 and total_income == 0:
        insight = "🌱 Start your month strong! Tap a quick preset below to log your first record."
    elif budget_amount and total_expense > budget_amount:
        over = round(total_expense - budget_amount, 2)
        insight = f"⚠️ Budget Alert: You have exceeded your ${budget_amount:,.0f} budget by ${over:,.2f}."
    elif total_income > 0 and savings_rate >= 40:
        insight = f"🔥 Excellent discipline! You are saving {savings_rate}% of your income this month."
    elif category_breakdown:
        top = category_breakdown[0]
        insight = f"💡 Top expense: {top['name']} makes up {top['percentage']}% (${top['total']:,.2f}) of your spending."
    else:
        insight = f"📊 Net cash flow is ${net_balance:,.2f} for this month."

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
        "savings_rate": savings_rate,
        "budget_amount": budget_amount,
        "budget_used_pct": budget_used_pct,
        "budget_remaining": budget_remaining,
        "insight": insight,
        "category_breakdown": category_breakdown,
        "available_months": available_months
    })

@app.route("/api/budget", methods=["POST"])
def set_budget():
    data = request.get_json() or {}
    month = data.get("month") or datetime.today().strftime("%Y-%m")
    try:
        amount = float(data.get("amount", 0))
        if amount <= 0:
            return jsonify({"error": "Budget must be greater than 0"}), 400
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid budget amount"}), 400

    conn = get_db()
    conn.execute(
        "INSERT INTO budgets (month, amount) VALUES (?, ?) ON CONFLICT(month) DO UPDATE SET amount=excluded.amount",
        (month, amount),
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Budget updated", "month": month, "amount": amount})

@app.route("/api/seed-sample-data", methods=["POST"])
def seed_sample_data():
    month = request.args.get("month") or datetime.today().strftime("%Y-%m")
    today_str = datetime.today().strftime("%Y-%m-%d")
    
    # 8 realistic starter transactions
    samples = [
        (3500.00, "income", "Salary", today_str, "Monthly Tech Salary"),
        (450.00, "income", "Freelance & Side Gig", today_str, "Mobile UI Design Project"),
        (120.00, "expense", "Groceries", today_str, "Weekly Supermarket Run"),
        (45.00, "expense", "Food & Dining", today_str, "Sushi Dinner"),
        (35.00, "expense", "Transportation", today_str, "Petrol / Gas station"),
        (85.00, "expense", "Utilities & Bills", today_str, "High-Speed Internet & Electric"),
        (24.00, "expense", "Entertainment", today_str, "Netflix & Spotify Premium"),
        (12.50, "expense", "Food & Dining", today_str, "Morning Artisan Coffee & Croissant"),
    ]

    conn = get_db()
    cursor = conn.cursor()
    # Map category names to IDs
    cats = {row["name"]: row["id"] for row in conn.execute("SELECT id, name FROM categories").fetchall()}
    
    for amount, tx_type, cat_name, date_val, desc in samples:
        cat_id = cats.get(cat_name)
        cursor.execute(
            """
            INSERT INTO transactions (amount, type, category_id, date, description)
            VALUES (?, ?, ?, ?, ?)
            """,
            (amount, tx_type, cat_id, date_val, desc),
        )

    # Set default budget $1,500
    cursor.execute(
        "INSERT INTO budgets (month, amount) VALUES (?, 1500.0) ON CONFLICT(month) DO NOTHING",
        (month,),
    )
    conn.commit()
    conn.close()
    return jsonify({"message": f"Successfully loaded {len(samples)} realistic transactions!"})

@app.route("/api/export-csv", methods=["GET"])
def export_csv():
    import io
    import csv
    from flask import Response

    month = request.args.get("month")
    conn = get_db()
    query = """
        SELECT t.id, t.date, t.type, c.name as category, t.amount, t.description
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
    """
    params = []
    if month:
        query += " WHERE strftime('%Y-%m', t.date) = ?"
        params.append(month)
    query += " ORDER BY t.date DESC"

    rows = conn.execute(query, params).fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Date", "Type", "Category", "Amount ($)", "Description"])
    for r in rows:
        writer.writerow([r["id"], r["date"], r["type"].capitalize(), r["category"] or "Uncategorized", f"{r['amount']:.2f}", r["description"] or ""])

    filename = f"cashflow_{month or 'all'}.csv"
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

if __name__ == "__main__":
    # Host on 0.0.0.0 so phone can connect on local Wi-Fi
    print("Starting Flask server on http://localhost:5000 ...")
    app.run(host="0.0.0.0", port=5000, debug=True)

