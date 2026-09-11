import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Income, User } from "../lib/api";
import DashboardHeader from "../components/DashboardHeader";
import DashboardNav from "../components/DashboardNav";
import { currencySymbol } from "../lib/currency";

export default function IncomePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [income, setIncome] = useState<Income[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    source: "",
    description: "",
    amount: "",
    currency: "EUR",
    date: new Date().toISOString().slice(0, 10),
    category: "",
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
    void loadIncome();
  }

  async function loadIncome() {
    const result = await api.listIncome();
    if (result.ok) {
      setIncome(result.data);
    } else {
      setStatus(result.error);
    }
  }

  const totalIncome = useMemo(
    () => income.reduce((sum, item) => sum + item.amount, 0),
    [income]
  );

  async function handleSave() {
    setLoading(true);
    setStatus(null);
    const payload = {
      source: form.source,
      description: form.description,
      amount: Number(form.amount || 0),
      currency: form.currency,
      date: form.date,
      category: form.category || null,
    };
    const result = editingId
      ? await api.updateIncome(editingId, payload)
      : await api.createIncome(payload);
    setLoading(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setStatus(editingId ? "Income updated." : "Income added.");
    setForm({
      source: "",
      description: "",
      amount: "",
      currency: "EUR",
      date: new Date().toISOString().slice(0, 10),
      category: "",
    });
    setEditingId(null);
    void loadIncome();
  }

  function handleEdit(item: Income) {
    setEditingId(item.id);
    setForm({
      source: item.source,
      description: item.description,
      amount: String(item.amount),
      currency: item.currency,
      date: item.date,
      category: item.category || "",
    });
  }

  async function handleDelete(id: string) {
    setLoading(true);
    setStatus(null);
    const result = await api.deleteIncome(id);
    setLoading(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setStatus("Income deleted.");
    if (editingId === id) {
      setEditingId(null);
    }
    void loadIncome();
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
                  <h3 className="font-display text-xl">Add income</h3>
                  <span className="text-xs text-haze">
                    Total {currencySymbol("EUR")} {totalIncome.toFixed(2)}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input
                    className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                    placeholder="Source"
                    value={form.source}
                    onChange={(event) => setForm({ ...form, source: event.target.value })}
                  />
                  <select
                    className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                    value={form.category}
                    onChange={(event) => setForm({ ...form, category: event.target.value })}
                  >
                    <option value="">Select category</option>
                    <option value="Client work">Client work</option>
                    <option value="Consulting">Consulting</option>
                    <option value="Royalties">Royalties</option>
                    <option value="Interest">Interest</option>
                    <option value="Refund">Refund</option>
                    <option value="Other">Other</option>
                  </select>
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
                  <button
                    className="md:col-span-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-glow"
                    onClick={handleSave}
                    type="button"
                    disabled={loading}
                  >
                    {editingId ? "Update income" : "Save income"}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl">Income</h3>
                <span className="text-xs text-haze">{income.length} total</span>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.2em] text-haze">
                    <tr>
                      <th className="pb-2">Source</th>
                      <th className="pb-2">Category</th>
                      <th className="pb-2">Amount</th>
                      <th className="pb-2">Date</th>
                      <th className="pb-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate">
                    {income.map((item) => (
                      <tr key={item.id} className="border-t border-ink/10">
                        <td className="py-3 font-semibold text-ink">{item.source}</td>
                        <td className="py-3">
                          {item.category ? (
                            <span className="rounded-full bg-ink/5 px-2 py-1 text-xs text-ink">
                              {item.category}
                            </span>
                          ) : (
                            <span className="text-xs text-haze">—</span>
                          )}
                        </td>
                        <td className="py-3">
                          {currencySymbol(item.currency)} {item.amount.toFixed(2)}
                        </td>
                        <td className="py-3">{item.date}</td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              className="rounded-lg border border-ink/10 px-3 py-1 text-xs font-semibold"
                              onClick={() => handleEdit(item)}
                              type="button"
                            >
                              Edit
                            </button>
                            <button
                              className="rounded-lg border border-ink/10 px-3 py-1 text-xs font-semibold"
                              onClick={() => handleDelete(item.id)}
                              type="button"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {income.length === 0 && (
                      <tr>
                        <td className="py-4 text-sm text-haze" colSpan={5}>
                          No income entries yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
