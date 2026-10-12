// State management
let currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
let currentFilter = "all";
let categoriesCache = [];
let categoryChartInstance = null;

// DOM Elements
const monthSelect = document.getElementById("monthSelect");
const netBalanceEl = document.getElementById("netBalance");
const totalIncomeEl = document.getElementById("totalIncome");
const totalExpenseEl = document.getElementById("totalExpense");
const savingsRateBadge = document.getElementById("savingsRateBadge");
const categoryBarsEl = document.getElementById("categoryBars");
const noExpenseState = document.getElementById("noExpenseState");
const transactionsListEl = document.getElementById("transactionsList");
const noTransactionsState = document.getElementById("noTransactionsState");
const chartContainer = document.getElementById("chartContainer");

// Modal Elements
const openModalBtn = document.getElementById("openModalBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const transactionModal = document.getElementById("transactionModal");
const transactionForm = document.getElementById("transactionForm");
const categorySelect = document.getElementById("categorySelect");
const dateInput = document.getElementById("dateInput");
const toastEl = document.getElementById("toast");

// Initialize application
document.addEventListener("DOMContentLoaded", async () => {
    // Set default date in modal to today
    dateInput.value = new Date().toISOString().split("T")[0];

    // Setup event listeners
    setupEventListeners();

    // Initial data fetch
    await fetchCategories();
    await loadDashboardData();
    lucide.createIcons();
});

function setupEventListeners() {
    // Month picker change
    monthSelect.addEventListener("change", (e) => {
        currentMonth = e.target.value;
        loadDashboardData();
    });

    // Filter tabs (All / Expense / Income)
    document.querySelectorAll(".filter-tab").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".filter-tab").forEach(t => t.classList.remove("active"));
            e.currentTarget.classList.add("active");
            currentFilter = e.currentTarget.dataset.filter;
            fetchTransactions();
        });
    });

    // Modal controls
    openModalBtn.addEventListener("click", () => {
        transactionModal.classList.remove("hidden");
        populateCategoryOptions();
    });

    const closeModal = () => transactionModal.classList.add("hidden");
    closeModalBtn.addEventListener("click", closeModal);
    cancelModalBtn.addEventListener("click", closeModal);

    // Close modal when tapping outside sheet
    transactionModal.addEventListener("click", (e) => {
        if (e.target === transactionModal) closeModal();
    });

    // Transaction type radio change (Expense vs Income)
    document.querySelectorAll('input[name="txType"]').forEach((radio) => {
        radio.addEventListener("change", () => {
            populateCategoryOptions();
        });
    });

    // Form submit
    transactionForm.addEventListener("submit", handleAddTransaction);
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2
    }).format(amount);
}

// Show Toast
function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.remove("hidden");
    setTimeout(() => {
        toastEl.classList.add("hidden");
    }, 2800);
}

// Fetch all categories once
async function fetchCategories() {
    try {
        const res = await fetch("/api/categories");
        const data = await res.json();
        categoriesCache = data.categories || [];
    } catch (err) {
        console.error("Failed to load categories:", err);
    }
}

// Filter and populate categories in dropdown based on selected type
function populateCategoryOptions() {
    const selectedType = document.querySelector('input[name="txType"]:checked').value;
    const filtered = categoriesCache.filter(c => c.type === selectedType);

    categorySelect.innerHTML = filtered.map(c => `
        <option value="${c.id}">${c.name}</option>
    `).join("");
}

// Load Summary and Transactions
async function loadDashboardData() {
    await fetchSummary();
    await fetchTransactions();
}

// Fetch and render monthly summary
async function fetchSummary() {
    try {
        const res = await fetch(`/api/summary?month=${encodeURIComponent(currentMonth)}`);
        const data = await res.json();

        // Update month dropdown if needed
        renderMonthDropdown(data.available_months, data.month);

        // Update Balance Hero Card
        const balance = data.net_balance || 0;
        netBalanceEl.textContent = (balance < 0 ? "-" : "") + formatCurrency(Math.abs(balance));
        netBalanceEl.style.color = balance < 0 ? "#fca5a5" : "#ffffff";

        totalIncomeEl.textContent = `+${formatCurrency(data.total_income || 0)}`;
        totalExpenseEl.textContent = `-${formatCurrency(data.total_expense || 0)}`;

        const savingsRate = data.savings_rate || 0;
        savingsRateBadge.textContent = `${savingsRate}% saved`;
        savingsRateBadge.className = `badge ${savingsRate >= 20 ? "badge-income" : "badge-neutral"}`;

        // Render Breakdown
        renderCategoryBreakdown(data.category_breakdown, data.total_expense);
    } catch (err) {
        console.error("Failed to load summary:", err);
    }
}

// Render available months in dropdown
function renderMonthDropdown(months, activeMonth) {
    if (!months || months.length === 0) return;
    
    monthSelect.innerHTML = months.map(m => {
        const [year, mon] = m.split("-");
        const dateObj = new Date(year, parseInt(mon) - 1);
        const label = dateObj.toLocaleDateString("en-US", { month: "short", year: "numeric" });
        return `<option value="${m}" ${m === activeMonth ? "selected" : ""}>${label}</option>`;
    }).join("");
}

// Render Category chart & progress bars
function renderCategoryBreakdown(breakdown, totalExpense) {
    if (!breakdown || breakdown.length === 0 || totalExpense === 0) {
        noExpenseState.classList.remove("hidden");
        chartContainer.classList.add("hidden");
        categoryBarsEl.innerHTML = "";
        return;
    }

    noExpenseState.classList.add("hidden");
    chartContainer.classList.remove("hidden");

    // Render Doughnut Chart
    renderChart(breakdown);

    // Render Progress Bars
    categoryBarsEl.innerHTML = breakdown.map(cat => `
        <div class="cat-bar-item">
            <div class="cat-bar-top">
                <div class="cat-name-badge">
                    <span class="cat-dot" style="background-color: ${cat.color};"></span>
                    <span>${cat.name}</span>
                </div>
                <span>${formatCurrency(cat.total)} (${cat.percentage}%)</span>
            </div>
            <div class="cat-bar-track">
                <div class="cat-bar-fill" style="width: ${cat.percentage}%; background-color: ${cat.color};"></div>
            </div>
        </div>
    `).join("");
}

// Chart.js helper
function renderChart(breakdown) {
    const ctx = document.getElementById("categoryChart").getContext("2d");
    const labels = breakdown.map(c => c.name);
    const dataValues = breakdown.map(c => c.total);
    const colors = breakdown.map(c => c.color);

    if (categoryChartInstance) {
        categoryChartInstance.destroy();
    }

    categoryChartInstance = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: "#ffffff"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` ${ctx.label}: ${formatCurrency(ctx.raw)}`
                    }
                }
            },
            cutout: "70%"
        }
    });
}

// Fetch and render transactions list
async function fetchTransactions() {
    try {
        let url = `/api/transactions?month=${encodeURIComponent(currentMonth)}`;
        if (currentFilter !== "all") {
            url += `&type=${currentFilter}`;
        }

        const res = await fetch(url);
        const data = await res.json();
        const txs = data.transactions || [];

        if (txs.length === 0) {
            noTransactionsState.classList.remove("hidden");
            transactionsListEl.innerHTML = "";
            return;
        }

        noTransactionsState.classList.add("hidden");
        transactionsListEl.innerHTML = txs.map(tx => {
            const isIncome = tx.type === "income";
            const amountPrefix = isIncome ? "+" : "-";
            const amountClass = isIncome ? "is-income" : "is-expense";
            const iconBg = isIncome ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)";
            const iconColor = isIncome ? "#10b981" : "#f43f5e";
            const catName = tx.category_name || (isIncome ? "Income" : "Expense");
            const iconName = tx.category_icon || (isIncome ? "arrow-down-left" : "arrow-up-right");

            return `
                <div class="transaction-row" data-id="${tx.id}">
                    <div class="tx-left">
                        <div class="tx-cat-icon" style="background-color: ${iconBg}; color: ${iconColor};">
                            <i data-lucide="${iconName}"></i>
                        </div>
                        <div class="tx-details">
                            <span class="tx-category">${escapeHtml(catName)}</span>
                            <span class="tx-meta">
                                ${tx.date}${tx.description ? ` • ${escapeHtml(tx.description)}` : ""}
                            </span>
                        </div>
                    </div>
                    <div class="tx-right">
                        <span class="tx-amount ${amountClass}">
                            ${amountPrefix}${formatCurrency(tx.amount)}
                        </span>
                        <button class="tx-delete-btn" onclick="deleteTransaction(${tx.id})" title="Delete record">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join("");

        lucide.createIcons();
    } catch (err) {
        console.error("Failed to load transactions:", err);
    }
}

// Handle Add Transaction form submission
async function handleAddTransaction(e) {
    e.preventDefault();
    const saveBtn = document.getElementById("saveTxBtn");
    saveBtn.disabled = true;

    const payload = {
        amount: parseFloat(document.getElementById("amountInput").value),
        type: document.querySelector('input[name="txType"]:checked').value,
        category_id: parseInt(categorySelect.value, 10),
        date: dateInput.value,
        description: document.getElementById("descInput").value
    };

    try {
        const res = await fetch("/api/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            transactionForm.reset();
            dateInput.value = new Date().toISOString().split("T")[0];
            transactionModal.classList.add("hidden");
            showToast("Record added successfully!");

            // If the transaction is in a different month, switch to it
            const txMonth = payload.date.slice(0, 7);
            currentMonth = txMonth;

            await loadDashboardData();
        } else {
            const err = await res.json();
            alert(err.error || "Failed to log transaction");
        }
    } catch (err) {
        alert("Network error: Could not reach the server.");
    } finally {
        saveBtn.disabled = false;
    }
}

// Delete transaction
async function deleteTransaction(id) {
    if (!confirm("Are you sure you want to delete this record?")) return;

    try {
        const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
        if (res.ok) {
            showToast("Record deleted.");
            await loadDashboardData();
        } else {
            alert("Could not delete record.");
        }
    } catch (err) {
        alert("Error connecting to server.");
    }
}

// Helper: Escape HTML strings to prevent XSS
function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, (m) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[m]);
}
