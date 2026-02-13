import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Expense, User } from "../lib/api";
import DashboardHeader from "../components/DashboardHeader";
import DashboardNav from "../components/DashboardNav";

export default function Expenses() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    vendor: "",
    description: "",
    amount: "",
    currency: "EUR",
    date: new Date().toISOString().slice(0, 10),
    category: "",
    receipt_url: "",
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
    void loadExpenses();
  }

  async function loadExpenses() {
    const result = await api.listExpenses();
    if (result.ok) {
      setExpenses(result.data);
    } else {
      setStatus(result.error);
    }
  }

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, exp) => sum + exp.amount, 0),
    [expenses]
  );

  async function handleSave() {
    setLoading(true);
    setStatus(null);
    const payload = {
      vendor: form.vendor,
      description: form.description,
      amount: Number(form.amount || 0),
      currency: form.currency,
      date: form.date,
      category: form.category || null,
      receipt_url: form.receipt_url || null,
    };
    const result = editingId
      ? await api.updateExpense(editingId, payload)
      : await api.createExpense(payload);
    setLoading(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setStatus(editingId ? "Expense updated." : "Expense added.");
    setForm({
      vendor: "",
      description: "",
      amount: "",
      currency: "EUR",
      date: new Date().toISOString().slice(0, 10),
      category: "",
      receipt_url: "",
    });
    setEditingId(null);
    void loadExpenses();
  }

  function handleEdit(expense: Expense) {
    setEditingId(expense.id);
    setForm({
      vendor: expense.vendor,
      description: expense.description,
      amount: String(expense.amount),
      currency: expense.currency,
      date: expense.date,
      category: expense.category || "",
      receipt_url: expense.receipt_url || "",
    });
  }

  async function handleDelete(id: string) {
    setLoading(true);
    setStatus(null);
    const result = await api.deleteExpense(id);
    setLoading(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setStatus("Expense deleted.");
    if (editingId === id) {
      setEditingId(null);
    }
    void loadExpenses();
  }

  async function handleReceiptUpload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setStatus("Receipt must be 5MB or less.");
      return;
    }
    setUploading(true);
    setStatus(null);
    const upload = await api.createReceiptUpload({
      filename: file.name,
      content_type: file.type || "application/octet-stream",
    });
    if (!upload.ok) {
      setUploading(false);
      setStatus(upload.error);
      return;
    }
    const res = await fetch(upload.data.upload_url, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    setUploading(false);
    if (!res.ok) {
      setStatus("Upload failed.");
      return;
    }
    setForm((prev) => ({ ...prev, receipt_url: upload.data.receipt_url }));
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

          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl">Add expense</h3>
                  <span className="text-xs text-haze">Total EUR {totalExpenses.toFixed(2)}</span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input
                    className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                    placeholder="Vendor"
                    value={form.vendor}
                    onChange={(event) => setForm({ ...form, vendor: event.target.value })}
                  />
                  <input
                    className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                    placeholder="Category"
                    value={form.category}
                    onChange={(event) => setForm({ ...form, category: event.target.value })}
                  />
                  <textarea
                    className="md:col-span-2 rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                    placeholder="Description"
                    rows={3}
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                  />
                  <input
                    className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                    type="number"
                    step="0.01"
                    placeholder="Amount"
                    value={form.amount}
                    onChange={(event) => setForm({ ...form, amount: event.target.value })}
                  />
                  <select
                    className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                    value={form.currency}
                    onChange={(event) => setForm({ ...form, currency: event.target.value })}
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                  <input
                    className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                    type="date"
                    value={form.date}
                    onChange={(event) => setForm({ ...form, date: event.target.value })}
                  />
                  <div className="md:col-span-2 rounded-2xl border border-ink/10 bg-white/70 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-haze">Receipt</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            void handleReceiptUpload(file);
                          }
                        }}
                      />
                      {uploading && <span className="text-xs text-slate">Uploading…</span>}
                      {form.receipt_url && (
                        <a
                          className="text-xs font-semibold text-ember"
                          href={form.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View receipt
                        </a>
                      )}
                    </div>
                  </div>
                  <button
                    className="md:col-span-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-glow"
                    onClick={handleSave}
                    type="button"
                    disabled={loading || uploading}
                  >
                    {editingId ? "Update expense" : "Save expense"}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
              <h3 className="font-display text-xl">Expenses</h3>
              <div className="mt-4 space-y-3">
                {expenses.map((expense) => (
                  <div key={expense.id} className="rounded-2xl border border-ink/10 bg-white/80 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-ink">{expense.vendor}</p>
                        <p className="text-xs text-haze">{expense.date}</p>
                      </div>
                      <span className="text-sm font-semibold text-ink">
                        {expense.currency} {expense.amount.toFixed(2)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate">{expense.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      {expense.category && (
                        <span className="rounded-full bg-ink/5 px-2 py-1 text-ink">
                          {expense.category}
                        </span>
                      )}
                      {expense.receipt_url && (
                        <a
                          className="font-semibold text-ember"
                          href={expense.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Receipt
                        </a>
                      )}
                      <button
                        className="ml-auto rounded-lg border border-ink/10 px-2 py-1"
                        onClick={() => handleEdit(expense)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-lg border border-ink/10 px-2 py-1"
                        onClick={() => handleDelete(expense.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {expenses.length === 0 && (
                  <p className="text-sm text-haze">No expenses yet.</p>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
