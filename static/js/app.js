// State management
let currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
let currentFilter = "all";
let searchQuery = "";
let categoriesCache = [];
let categoryChartInstance = null;
let allTransactionsCache = [];

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
const insightTextEl = document.getElementById("insightText");

// Budget Elements
const budgetSpentText = document.getElementById("budgetSpentText");
const budgetLimitText = document.getElementById("budgetLimitText");
const budgetFill = document.getElementById("budgetFill");
const budgetPercentText = document.getElementById("budgetPercentText");
const budgetRemainingText = document.getElementById("budgetRemainingText");
const editBudgetBtn = document.getElementById("editBudgetBtn");
const budgetModal = document.getElementById("budgetModal");
const closeBudgetModalBtn = document.getElementById("closeBudgetModalBtn");
const cancelBudgetBtn = document.getElementById("cancelBudgetBtn");
const budgetForm = document.getElementById("budgetForm");
const budgetInput = document.getElementById("budgetInput");

// Transaction Modal Elements
const openModalBtn = document.getElementById("openModalBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const transactionModal = document.getElementById("transactionModal");
const transactionForm = document.getElementById("transactionForm");
const categorySelect = document.getElementById("categorySelect");
const specificExpenseGroup = document.getElementById("specificExpenseGroup");
const specificExpenseInput = document.getElementById("specificExpenseInput");
const specificLabelText = document.getElementById("specificLabelText");
const dateInput = document.getElementById("dateInput");
const amountInput = document.getElementById("amountInput");
const descInput = document.getElementById("descInput");
const toastEl = document.getElementById("toast");

// Tools & Search
const searchInput = document.getElementById("searchInput");
const seedDataBtn = document.getElementById("seedDataBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");

// Initialize application
document.addEventListener("DOMContentLoaded", async () => {
    dateInput.value = new Date().toISOString().split("T")[0];

    setupEventListeners();
    await fetchCategories();
    await loadDashboardData();
    lucide.createIcons();
});

function setupEventListeners() {
    // Month picker change
    monthSelect.addEventListener("change", (e) => {
        currentMonth = e.target.value;
        exportCsvBtn.href = `/api/export-csv?month=${encodeURIComponent(currentMonth)}`;
        loadDashboardData();
    });

    // Filter tabs (All / Expense / Income)
    document.querySelectorAll(".filter-tab").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".filter-tab").forEach(t => t.classList.remove("active"));
            e.currentTarget.classList.add("active");
            currentFilter = e.currentTarget.dataset.filter;
            renderFilteredTransactions();
        });
    });

    // Live search input
    searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderFilteredTransactions();
    });

    // Modal controls
    openModalBtn.addEventListener("click", () => {
        transactionForm.reset();
        dateInput.value = new Date().toISOString().split("T")[0];
        document.querySelector('input[name="txType"][value="expense"]').checked = true;
        populateCategoryOptions();
        transactionModal.classList.remove("hidden");
    });

    const closeModal = () => transactionModal.classList.add("hidden");
    closeModalBtn.addEventListener("click", closeModal);
    cancelModalBtn.addEventListener("click", closeModal);

    transactionModal.addEventListener("click", (e) => {
        if (e.target === transactionModal) closeModal();
    });

    // Type toggle change (Expense / Income)
    document.querySelectorAll('input[name="txType"]').forEach((radio) => {
        radio.addEventListener("change", () => {
            populateCategoryOptions();
        });
    });

    // Category select change: check for "Other Expense" / "Other Income"
    categorySelect.addEventListener("change", handleCategoryChange);

    // Transaction form submit
    transactionForm.addEventListener("submit", handleAddTransaction);

    // Budget Modal controls
    editBudgetBtn.addEventListener("click", () => {
        budgetModal.classList.remove("hidden");
    });
    const closeBudget = () => budgetModal.classList.add("hidden");
    closeBudgetModalBtn.addEventListener("click", closeBudget);
    cancelBudgetBtn.addEventListener("click", closeBudget);
    budgetModal.addEventListener("click", (e) => {
        if (e.target === budgetModal) closeBudget();
    });

    budgetForm.addEventListener("submit", handleSetBudget);

    // Seed sample data
    seedDataBtn.addEventListener("click", handleSeedSampleData);
}

// When category changes, prompt for specific item if 'Other' is chosen
function handleCategoryChange() {
    const selectedCatId = parseInt(categorySelect.value, 10);
    const selectedCat = categoriesCache.find(c => c.id === selectedCatId);
    const catName = selectedCat ? selectedCat.name.toLowerCase() : "";

    if (catName.includes("other expense") || catName.includes("other income")) {
        specificExpenseGroup.classList.remove("hidden");
        specificExpenseInput.required = true;
        const isIncome = catName.includes("income");
        specificLabelText.textContent = isIncome ? "What specific income is this? *" : "What specific expense is this? *";
        specificExpenseInput.placeholder = isIncome 
            ? "e.g. Sold laptop, Bonus, Cash gift, Tax refund" 
            : "e.g. Gym membership, Haircut, Parking fee, Course textbook";
        setTimeout(() => specificExpenseInput.focus(), 150);
    } else {
        specificExpenseGroup.classList.add("hidden");
        specificExpenseInput.required = false;
        specificExpenseInput.value = "";
    }
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

// Populate categories in modal based on selected type
function populateCategoryOptions() {
    const selectedType = document.querySelector('input[name="txType"]:checked').value;
    const filtered = categoriesCache.filter(c => c.type === selectedType);

    categorySelect.innerHTML = filtered.map(c => `
        <option value="${c.id}">${c.name}</option>
    `).join("");

    handleCategoryChange();
}

// Load Summary and Transactions
async function loadDashboardData() {
    await fetchSummary();
    await fetchTransactions();
}

// Fetch summary and render budget + breakdown + insight
async function fetchSummary() {
    try {
        const res = await fetch(`/api/summary?month=${encodeURIComponent(currentMonth)}`);
        const data = await res.json();

        renderMonthDropdown(data.available_months, data.month);

        // Balance Hero Card
        const balance = data.net_balance || 0;
        netBalanceEl.textContent = (balance < 0 ? "-" : "") + formatCurrency(Math.abs(balance));
        netBalanceEl.style.color = balance < 0 ? "#fb7185" : "#ffffff";

        totalIncomeEl.textContent = `+${formatCurrency(data.total_income || 0)}`;
        totalExpenseEl.textContent = `-${formatCurrency(data.total_expense || 0)}`;

        const savingsRate = data.savings_rate || 0;
        savingsRateBadge.textContent = `${savingsRate}% saved`;

        // Insight banner
        if (data.insight) {
            insightTextEl.textContent = data.insight;
        }

        // Budget section
        renderBudget(data.total_expense, data.budget_amount, data.budget_used_pct, data.budget_remaining);

        // Breakdown section
        renderCategoryBreakdown(data.category_breakdown, data.total_expense);
    } catch (err) {
        console.error("Failed to load summary:", err);
    }
}

// Render Monthly Budget meter
function renderBudget(spent, budget, usedPct, remaining) {
    budgetSpentText.textContent = `${formatCurrency(spent)} spent`;
    budgetLimitText.textContent = `of ${formatCurrency(budget)} target`;
    budgetPercentText.textContent = `${usedPct}% used`;
    budgetRemainingText.textContent = `${formatCurrency(remaining)} remaining`;

    const fillWidth = Math.min(100, usedPct);
    budgetFill.style.width = `${fillWidth}%`;

    // Dynamic color levels
    budgetFill.classList.remove("warning", "danger");
    if (usedPct >= 100) {
        budgetFill.classList.add("danger");
        budgetRemainingText.style.color = "#fb7185";
        budgetRemainingText.textContent = `Over by ${formatCurrency(spent - budget)}`;
    } else if (usedPct >= 75) {
        budgetFill.classList.add("warning");
        budgetRemainingText.style.color = "#f59e0b";
    } else {
        budgetRemainingText.style.color = "#34d399";
    }
    budgetInput.value = budget;
}

// Render available months
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

    renderChart(breakdown);

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

// Dark theme Chart.js doughnut
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
                borderColor: "#1e293b"
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

// Fetch transactions
async function fetchTransactions() {
    try {
        const url = `/api/transactions?month=${encodeURIComponent(currentMonth)}`;
        const res = await fetch(url);
        const data = await res.json();
        allTransactionsCache = data.transactions || [];
        renderFilteredTransactions();
    } catch (err) {
        console.error("Failed to load transactions:", err);
    }
}

// Render filtered & searched transactions
function renderFilteredTransactions() {
    let filtered = allTransactionsCache;

    // Filter by type
    if (currentFilter !== "all") {
        filtered = filtered.filter(tx => tx.type === currentFilter);
    }

    // Filter by search query
    if (searchQuery) {
        filtered = filtered.filter(tx => {
            const desc = (tx.description || "").toLowerCase();
            const cat = (tx.category_name || "").toLowerCase();
            return desc.includes(searchQuery) || cat.includes(searchQuery);
        });
    }

    if (filtered.length === 0) {
        noTransactionsState.classList.remove("hidden");
        transactionsListEl.innerHTML = "";
        return;
    }

    noTransactionsState.classList.add("hidden");
    transactionsListEl.innerHTML = filtered.map(tx => {
        const isIncome = tx.type === "income";
        const amountPrefix = isIncome ? "+" : "-";
        const amountClass = isIncome ? "is-income" : "is-expense";
        const iconBg = isIncome ? "rgba(16, 185, 129, 0.18)" : "rgba(244, 63, 94, 0.18)";
        const iconColor = isIncome ? "#34d399" : "#fb7185";
        
        const isOther = (tx.category_name || "").toLowerCase().includes("other");
        // If it's an Other Expense with a note, display the specific item as title!
        const titleName = (isOther && tx.description) ? tx.description : (tx.category_name || (isIncome ? "Income" : "Expense"));
        const subtitleText = (isOther && tx.description) 
            ? `${tx.category_name} • ${tx.date}` 
            : `${tx.date}${tx.description ? ` • ${escapeHtml(tx.description)}` : ""}`;
        const iconName = tx.category_icon || (isIncome ? "arrow-down-left" : "arrow-up-right");

        return `
            <div class="transaction-row" data-id="${tx.id}">
                <div class="tx-left">
                    <div class="tx-cat-icon" style="background-color: ${iconBg}; color: ${iconColor};">
                        <i data-lucide="${iconName}"></i>
                    </div>
                    <div class="tx-details">
                        <span class="tx-category">${escapeHtml(titleName)}</span>
                        <span class="tx-meta">
                            ${subtitleText}
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
}

// Handle Add Transaction form submit
async function handleAddTransaction(e) {
    e.preventDefault();
    const saveBtn = document.getElementById("saveTxBtn");
    saveBtn.disabled = true;

    const selectedCatId = parseInt(categorySelect.value, 10);
    const selectedCat = categoriesCache.find(c => c.id === selectedCatId);
    const catName = selectedCat ? selectedCat.name.toLowerCase() : "";
    const isOther = catName.includes("other expense") || catName.includes("other income");

    let finalDesc = descInput.value.trim();
    if (isOther) {
        const specificName = specificExpenseInput.value.trim();
        if (!specificName) {
            showToast("Please specify what this item was for!");
            specificExpenseInput.focus();
            saveBtn.disabled = false;
            return;
        }
        finalDesc = specificName + (finalDesc ? ` (${finalDesc})` : "");
    }

    const payload = {
        amount: parseFloat(amountInput.value),
        type: document.querySelector('input[name="txType"]:checked').value,
        category_id: selectedCatId,
        date: dateInput.value,
        description: finalDesc
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
            specificExpenseGroup.classList.add("hidden");
            transactionModal.classList.add("hidden");
            showToast("Record added successfully!");

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

// Handle Setting Budget
async function handleSetBudget(e) {
    e.preventDefault();
    const amount = parseFloat(budgetInput.value);
    if (!amount || amount <= 0) return;

    try {
        const res = await fetch("/api/budget", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ month: currentMonth, amount: amount })
        });
        if (res.ok) {
            budgetModal.classList.add("hidden");
            showToast("Budget target updated!");
            await fetchSummary();
        }
    } catch (err) {
        alert("Failed to update budget.");
    }
}

// Handle Seed Sample Data
async function handleSeedSampleData() {
    if (!confirm("Load realistic sample transactions for this month to test the charts & features?")) return;
    try {
        const res = await fetch(`/api/seed-sample-data?month=${encodeURIComponent(currentMonth)}`, {
            method: "POST"
        });
        if (res.ok) {
            showToast("Sample transactions loaded!");
            await loadDashboardData();
        }
    } catch (err) {
        alert("Failed to load sample data.");
    }
}

// Delete transaction
async function deleteTransaction(id) {
    if (!confirm("Delete this record?")) return;

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

// Helper: Escape HTML strings
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
