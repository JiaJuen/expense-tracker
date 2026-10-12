# 💰 CashFlow — Personal Expense & Income Tracker

A clean, mobile-first personal finance web dashboard built with Python, Flask, SQLite, and vanilla JavaScript.

---

## 🚀 Quick Start

### 1. Activate Environment
Open your terminal in VS Code and activate the Conda environment:
```bash
conda activate expense-tracker
```

### 2. Run the Application
```bash
python app.py
```

### 3. Open in Browser
- **On your PC**: [http://localhost:5000](http://localhost:5000)
- **On your Phone** (connected to the same Wi-Fi):
  ```
  http://192.168.100.17:5000
  ```

---

## 📱 How to Use on Your Phone Like a Native App

1. Ensure your phone is connected to the same Wi-Fi network as your PC.
2. Open Safari (iOS) or Chrome (Android) and go to:
   ```
   http://192.168.100.17:5000
   ```
3. **Save to Home Screen**:
   - **iPhone (Safari)**: Tap the **Share** button (box with upward arrow) -> Tap **"Add to Home Screen"**.
   - **Android (Chrome)**: Tap the **three dots menu** (⋮) -> Tap **"Add to Home screen"** / **"Install app"**.
4. You now have an app icon on your phone that launches full-screen!

---

## 📁 Project Structure

```
Expenses Record/
├── app.py                # Flask web backend & REST API endpoints
├── test_api.py           # Automated unit test suite
├── database/
│   ├── expenses.db       # SQLite database
│   ├── schema.sql        # Database schema definitions
│   └── setup_db.py       # Database initialization & seeding script
├── static/
│   ├── css/
│   │   └── style.css     # Mobile-responsive app styling
│   └── js/
│       └── app.js        # Dynamic frontend logic & Chart.js integration
├── templates/
│   └── index.html        # App layout & mobile bottom sheet modal
└── requirements.txt      # Project dependencies
```
