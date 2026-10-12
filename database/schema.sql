-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    icon TEXT DEFAULT 'tag',
    color TEXT DEFAULT '#4F46E5'
);

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL CHECK (amount > 0),
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    category_id INTEGER,
    date TEXT NOT NULL, -- Format: YYYY-MM-DD
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
);

-- Indexes for fast filtering and monthly summaries
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions (type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category_id);

-- Budgets Table (Monthly target limit)
CREATE TABLE IF NOT EXISTS budgets (
    month TEXT PRIMARY KEY, -- Format: YYYY-MM
    amount REAL NOT NULL CHECK (amount > 0)
);

