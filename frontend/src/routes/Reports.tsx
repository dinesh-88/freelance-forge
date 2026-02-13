import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Expense, Invoice, User } from "../lib/api";
import DashboardHeader from "../components/DashboardHeader";
import DashboardNav from "../components/DashboardNav";
import { currencySymbol } from "../lib/currency";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Reports() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();
  const [range, setRange] = useState({
    start: `${currentYear}-01-01`,
    end: `${currentYear}-12-31`,
  });
  const [summaryYear, setSummaryYear] = useState(String(currentYear));

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
    const invoiceResult = await api.listInvoices();
    if (invoiceResult.ok) {
      setInvoices(invoiceResult.data);
    } else {
      setStatus(invoiceResult.error);
    }
    const expenseResult = await api.listExpenses();
    if (expenseResult.ok) {
      setExpenses(expenseResult.data);
    } else {
      setStatus(expenseResult.error);
    }
  }

  const totals = useMemo(() => {
    const start = new Date(range.start);
    const end = new Date(range.end);
    const inRange = (dateValue: string) => {
      const date = new Date(dateValue);
      return date >= start && date <= end;
    };
    const totalRevenue = invoices
      .filter((invoice) => inRange(invoice.date))
      .reduce((sum, invoice) => sum + invoice.total_amount, 0);
    const totalExpenses = expenses
      .filter((expense) => inRange(expense.date))
      .reduce((sum, expense) => sum + expense.amount, 0);
    const avgInvoice = invoices.length ? totalRevenue / invoices.length : 0;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthRevenue = invoices
      .filter((invoice) => {
        const date = new Date(invoice.date);
        return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
      })
      .reduce((sum, invoice) => sum + invoice.total_amount, 0);
    const monthExpenses = expenses
      .filter((expense) => {
        const date = new Date(expense.date);
        return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
      })
      .reduce((sum, expense) => sum + expense.amount, 0);
    return {
      totalRevenue,
      totalExpenses,
      avgInvoice,
      monthRevenue,
      monthExpenses,
    };
  }, [invoices, expenses, range]);

  const monthlySeries = useMemo(() => {
    const startDate = new Date(range.start);
    const endDate = new Date(range.end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return [];
    }
    const start = startDate <= endDate ? startDate : endDate;
    const end = startDate <= endDate ? endDate : startDate;

    const series: Array<{ label: string; value: number }> = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= last) {
      const label = `${MONTHS[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(-2)}`;
      const value = invoices
        .filter((invoice) => {
          const date = new Date(invoice.date);
          return date.getFullYear() === cursor.getFullYear() && date.getMonth() === cursor.getMonth();
        })
        .reduce((sum, invoice) => sum + invoice.total_amount, 0);
      series.push({ label, value });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return series;
  }, [invoices, range]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    invoices.forEach((invoice) => years.add(new Date(invoice.date).getFullYear()));
    expenses.forEach((expense) => years.add(new Date(expense.date).getFullYear()));
    years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [invoices, expenses, currentYear]);

  const yearlyTotals = useMemo(() => {
    const year = Number(summaryYear);
    const totalRevenue = invoices
      .filter((invoice) => new Date(invoice.date).getFullYear() === year)
      .reduce((sum, invoice) => sum + invoice.total_amount, 0);
    const totalExpenses = expenses
      .filter((expense) => new Date(expense.date).getFullYear() === year)
      .reduce((sum, expense) => sum + expense.amount, 0);
    return {
      totalRevenue,
      totalExpenses,
      net: totalRevenue - totalExpenses,
    };
  }, [invoices, expenses, summaryYear]);

  const maxValue = Math.max(...monthlySeries.map((item) => item.value), 1);

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

          <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift lg:col-span-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-haze">Date range</p>
                  <p className="mt-2 text-sm text-slate">
                    Reporting for {range.start} → {range.end}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    className="rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-sm"
                    type="date"
                    value={range.start}
                    onChange={(event) => setRange((prev) => ({ ...prev, start: event.target.value }))}
                  />
                  <input
                    className="rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-sm"
                    type="date"
                    value={range.end}
                    onChange={(event) => setRange((prev) => ({ ...prev, end: event.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
              <p className="text-xs uppercase tracking-[0.2em] text-haze">Total revenue</p>
              <p className="mt-3 text-2xl font-semibold text-ink">
                {currencySymbol("EUR")} {totals.totalRevenue.toFixed(2)}
              </p>
              <p className="mt-2 text-sm text-slate">All invoices to date.</p>
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
              <p className="text-xs uppercase tracking-[0.2em] text-haze">Total expenses</p>
              <p className="mt-3 text-2xl font-semibold text-ink">
                {currencySymbol("EUR")} {totals.totalExpenses.toFixed(2)}
              </p>
              <p className="mt-2 text-sm text-slate">Expenses recorded.</p>
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
              <p className="text-xs uppercase tracking-[0.2em] text-haze">Invoices</p>
              <p className="mt-3 text-2xl font-semibold text-ink">{invoices.length}</p>
              <p className="mt-2 text-sm text-slate">Average EUR {totals.avgInvoice.toFixed(2)}.</p>
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
              <p className="text-xs uppercase tracking-[0.2em] text-haze">This month</p>
              <p className="mt-3 text-2xl font-semibold text-ink">
                {currencySymbol("EUR")} {(totals.monthRevenue - totals.monthExpenses).toFixed(2)}
              </p>
              <p className="mt-2 text-sm text-slate">
                Revenue {currencySymbol("EUR")} {totals.monthRevenue.toFixed(2)} · Expenses {currencySymbol("EUR")} {totals.monthExpenses.toFixed(2)}
              </p>
            </div>
          </section>

          <section className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl">Income trend</h3>
              <span className="text-xs uppercase tracking-[0.2em] text-haze">Range trend</span>
            </div>
            <div className="mt-6 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))" }}>
              {monthlySeries.map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-2 text-xs text-slate">
                  <div className="relative h-36 w-10 rounded-full bg-ink/5">
                    <div
                      className="absolute bottom-0 w-10 rounded-full bg-ember/70"
                      style={{ height: `${(item.value / maxValue) * 100}%` }}
                    />
                  </div>
                  <span>{item.label}</span>
                  <span className="text-[11px] text-haze">
                    {currencySymbol("EUR")} {item.value.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h3 className="font-display text-xl">Yearly summary</h3>
              <div className="flex items-center gap-3 text-sm">
                <label className="text-xs uppercase tracking-[0.2em] text-haze">Year</label>
                <select
                  className="rounded-xl border border-ink/10 bg-white/80 px-3 py-2"
                  value={summaryYear}
                  onChange={(event) => setSummaryYear(event.target.value)}
                >
                  {availableYears.map((year) => (
                    <option key={year} value={String(year)}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-ink/10 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-haze">Income</p>
                <p className="mt-2 text-lg font-semibold text-ink">
                  {currencySymbol("EUR")} {yearlyTotals.totalRevenue.toFixed(2)}
                </p>
              </div>
              <div className="rounded-2xl border border-ink/10 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-haze">Expenses</p>
                <p className="mt-2 text-lg font-semibold text-ink">
                  {currencySymbol("EUR")} {yearlyTotals.totalExpenses.toFixed(2)}
                </p>
              </div>
              <div className="rounded-2xl border border-ink/10 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-haze">Net</p>
                <p className="mt-2 text-lg font-semibold text-ink">
                  {currencySymbol("EUR")} {yearlyTotals.net.toFixed(2)}
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
