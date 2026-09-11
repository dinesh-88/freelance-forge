import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Budget, Expense, User } from "../lib/api";
import DashboardHeader from "../components/DashboardHeader";
import DashboardNav from "../components/DashboardNav";
import { currencySymbol } from "../lib/currency";

const OVERALL = "Overall";
const CATEGORIES = ["Travel", "Software", "Hardware", "Office", "Marketing", "Services", "Other"];
const BUDGET_CATEGORIES = [OVERALL, ...CATEGORIES];

export default function Budgets() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    category: OVERALL,
    monthly_limit: "",
    currency: "EUR",
  });

  useEffect(() => {
    void loadSession();
  }, []);

  async function loadSession() {
    const result = await api.me();
    if (!result.ok) {
      navigate("/", { replace: true });
      return;
    }
    setUser(result.data);
    await Promise.all([loadBudgets(), loadExpenses()]);
  }

  async function loadBudgets() {
    const result = await api.listBudgets();
    if (result.ok) {
      setBudgets(result.data);
    } else {
      setStatus(result.error);
    }
  }

  async function loadExpenses() {
    const result = await api.listExpenses();
    if (result.ok) {
      setExpenses(result.data);
    } else {
      setStatus(result.error);
    }
  }

  const monthExpenses = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return expenses.filter((expense) => {
      const date = new Date(expense.date);
      return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
    });
  }, [expenses]);

  const totalSpentThisMonth = useMemo(
    () => monthExpenses.reduce((sum, expense) => sum + expense.amount, 0),
    [monthExpenses]
  );

  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>();
    monthExpenses.forEach((expense) => {
      const category = expense.category || "Other";
      map.set(category, (map.get(category) || 0) + expense.amount);
    });
    return map;
  }, [monthExpenses]);

  const unbudgetedCategories = useMemo(() => {
    const budgeted = new Set(budgets.map((budget) => budget.category));
    return CATEGORIES.filter(
      (category) => !budgeted.has(category) && (spentByCategory.get(category) || 0) > 0
    );
  }, [budgets, spentByCategory]);

  async function handleSave() {
    setLoading(true);
    setStatus(null);
    const payload = {
      category: form.category,
      monthly_limit: Number(form.monthly_limit || 0),
      currency: form.currency,
    };
    const result = editingId
      ? await api.updateBudget(editingId, payload)
      : await api.createBudget(payload);
    setLoading(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setStatus(editingId ? "Budget updated." : "Budget saved.");
    setForm({ category: OVERALL, monthly_limit: "", currency: "EUR" });
    setEditingId(null);
    void loadBudgets();
  }

  function handleEdit(budget: Budget) {
    setEditingId(budget.id);
    setForm({
      category: budget.category,
      monthly_limit: String(budget.monthly_limit),
      currency: budget.currency,
    });
  }

  function handleQuickSet(category: string) {
    setEditingId(null);
    setForm({ category, monthly_limit: "", currency: "EUR" });
  }

  async function handleDelete(id: string) {
    setLoading(true);
    setStatus(null);
    const result = await api.deleteBudget(id);
    setLoading(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setStatus("Budget deleted.");
    if (editingId === id) {
      setEditingId(null);
    }
    void loadBudgets();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cloud via-white to-[#E6F6F5] text-ink">
      <div className="relative overflow-hidden">
        <div className="absolute -left-32 -top-28 h-80 w-80 rounded-full bg-ember/20 blur-3xl" />
        <div className="absolute right-0 top-10 h-72 w-72 rounded-full bg-moss/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#C7EFEB]/30 blur-3xl" />

        <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-10">
          <DashboardHeader user={user} />

          <DashboardNav activeSection={null} onSelect={(section) => navigate(`/app?section=${section}`)} />

          {status && (
            <div className="rounded-2xl border border-ember/30 bg-white/70 px-6 py-4 text-sm text-slate shadow-glow">
              {status}
            </div>
          )}

          <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
              <h3 className="font-display text-xl">
                {editingId ? "Edit budget" : "Set a monthly budget"}
              </h3>
              <div className="mt-4 grid gap-3">
                <select
                  className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  disabled={!!editingId}
                >
                  {BUDGET_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                    type="number"
                    step="0.01"
                    placeholder="Monthly limit"
                    value={form.monthly_limit}
                    onChange={(event) => setForm({ ...form, monthly_limit: event.target.value })}
                  />
                  <select
                    className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                    value={form.currency}
                    onChange={(event) => setForm({ ...form, currency: event.target.value })}
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <button
                  className="rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-glow"
                  onClick={handleSave}
                  type="button"
                  disabled={loading}
                >
                  {editingId ? "Update budget" : "Save budget"}
                </button>
                {editingId && (
                  <button
                    className="rounded-xl border border-ink/10 px-4 py-3 text-sm font-semibold text-slate"
                    onClick={() => {
                      setEditingId(null);
                      setForm({ category: OVERALL, monthly_limit: "", currency: "EUR" });
                    }}
                    type="button"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {unbudgetedCategories.length > 0 && (
                <div className="mt-6 rounded-2xl border border-ink/10 bg-white/70 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-haze">
                    Spending without a budget
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    {unbudgetedCategories.map((category) => (
                      <div
                        key={category}
                        className="flex items-center justify-between rounded-xl bg-ink/5 px-3 py-2 text-sm"
                      >
                        <span>
                          {category}
                          <span className="ml-2 text-xs text-haze">
                            {currencySymbol("EUR")} {(spentByCategory.get(category) || 0).toFixed(2)} this month
                          </span>
                        </span>
                        <button
                          className="rounded-lg border border-ink/10 px-3 py-1 text-xs font-semibold"
                          onClick={() => handleQuickSet(category)}
                          type="button"
                        >
                          Set a budget
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl">This month</h3>
                <span className="text-xs text-haze">{budgets.length} budgets</span>
              </div>
              <div className="mt-4 flex flex-col gap-4">
                {budgets.map((budget) => {
                  const spent =
                    budget.category === OVERALL
                      ? totalSpentThisMonth
                      : spentByCategory.get(budget.category) || 0;
                  const pct = budget.monthly_limit > 0 ? (spent / budget.monthly_limit) * 100 : 0;
                  const over = spent > budget.monthly_limit;
                  const remaining = budget.monthly_limit - spent;
                  return (
                    <div key={budget.id} className="rounded-2xl border border-ink/10 bg-white/80 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-ink">{budget.category}</p>
                          <p className="text-xs text-haze">
                            {currencySymbol(budget.currency)} {spent.toFixed(2)} of{" "}
                            {currencySymbol(budget.currency)} {budget.monthly_limit.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-semibold ${over ? "text-ember" : "text-moss"}`}
                          >
                            {over
                              ? `Over by ${currencySymbol(budget.currency)} ${Math.abs(remaining).toFixed(2)}`
                              : `${currencySymbol(budget.currency)} ${remaining.toFixed(2)} left`}
                          </span>
                          <button
                            className="rounded-lg border border-ink/10 px-3 py-1 text-xs font-semibold"
                            onClick={() => handleEdit(budget)}
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            className="rounded-lg border border-ink/10 px-3 py-1 text-xs font-semibold"
                            onClick={() => handleDelete(budget.id)}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink/5">
                        <div
                          className={`h-full rounded-full ${over ? "bg-ember" : "bg-moss"}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {budgets.length === 0 && (
                  <p className="text-sm text-haze">No budgets set yet. Add one on the left.</p>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
