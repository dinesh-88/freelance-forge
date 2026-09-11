import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Expense, Income, Invoice, User } from "../lib/api";
import DashboardHeader from "../components/DashboardHeader";
import DashboardNav from "../components/DashboardNav";
import { currencySymbol } from "../lib/currency";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function Tracker() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

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

    const [invoiceResult, incomeResult, expenseResult] = await Promise.all([
      api.listInvoices(),
      api.listIncome(),
      api.listExpenses(),
    ]);
    if (invoiceResult.ok) {
      setInvoices(invoiceResult.data);
    } else {
      setStatus(invoiceResult.error);
    }
    if (incomeResult.ok) {
      setIncome(incomeResult.data);
    } else {
      setStatus(incomeResult.error);
    }
    if (expenseResult.ok) {
      setExpenses(expenseResult.data);
    } else {
      setStatus(expenseResult.error);
    }
  }

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    invoices.forEach((invoice) => years.add(new Date(invoice.date).getFullYear()));
    income.forEach((item) => years.add(new Date(item.date).getFullYear()));
    expenses.forEach((expense) => years.add(new Date(expense.date).getFullYear()));
    years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [invoices, income, expenses, currentYear]);

  const monthlyRows = useMemo(() => {
    return MONTHS.map((label, monthIndex) => {
      const invoiceIncome = invoices
        .filter((invoice) => {
          const date = new Date(invoice.date);
          return date.getFullYear() === year && date.getMonth() === monthIndex;
        })
        .reduce((sum, invoice) => sum + invoice.total_amount, 0);
      const manualIncome = income
        .filter((item) => {
          const date = new Date(item.date);
          return date.getFullYear() === year && date.getMonth() === monthIndex;
        })
        .reduce((sum, item) => sum + item.amount, 0);
      const monthExpenses = expenses
        .filter((expense) => {
          const date = new Date(expense.date);
          return date.getFullYear() === year && date.getMonth() === monthIndex;
        })
        .reduce((sum, expense) => sum + expense.amount, 0);
      const totalIncome = invoiceIncome + manualIncome;
      return {
        label,
        invoiceIncome,
        manualIncome,
        totalIncome,
        expenses: monthExpenses,
        net: totalIncome - monthExpenses,
      };
    });
  }, [invoices, income, expenses, year]);

  const yearTotals = useMemo(
    () =>
      monthlyRows.reduce(
        (acc, row) => ({
          totalIncome: acc.totalIncome + row.totalIncome,
          expenses: acc.expenses + row.expenses,
          net: acc.net + row.net,
        }),
        { totalIncome: 0, expenses: 0, net: 0 }
      ),
    [monthlyRows]
  );

  const maxValue = Math.max(
    ...monthlyRows.map((row) => Math.max(row.totalIncome, row.expenses)),
    1
  );

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

          <section className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-haze">Monthly tracker</p>
                <p className="mt-2 text-sm text-slate">Income vs. expenses, month by month.</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <label className="text-xs uppercase tracking-[0.2em] text-haze">Year</label>
                <select
                  className="rounded-xl border border-ink/10 bg-white/80 px-3 py-2"
                  value={String(year)}
                  onChange={(event) => setYear(Number(event.target.value))}
                >
                  {availableYears.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
              <p className="text-xs uppercase tracking-[0.2em] text-haze">Total income</p>
              <p className="mt-3 text-2xl font-semibold text-ink">
                {currencySymbol("EUR")} {yearTotals.totalIncome.toFixed(2)}
              </p>
              <p className="mt-2 text-sm text-slate">Invoices + manual income.</p>
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
              <p className="text-xs uppercase tracking-[0.2em] text-haze">Total expenses</p>
              <p className="mt-3 text-2xl font-semibold text-ink">
                {currencySymbol("EUR")} {yearTotals.expenses.toFixed(2)}
              </p>
              <p className="mt-2 text-sm text-slate">For {year}.</p>
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
              <p className="text-xs uppercase tracking-[0.2em] text-haze">Net</p>
              <p className="mt-3 text-2xl font-semibold text-ink">
                {currencySymbol("EUR")} {yearTotals.net.toFixed(2)}
              </p>
              <p className="mt-2 text-sm text-slate">Income minus expenses.</p>
            </div>
          </section>

          <section className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl">Income vs. expenses</h3>
              <span className="text-xs uppercase tracking-[0.2em] text-haze">{year}</span>
            </div>
            <div className="mt-6 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))" }}>
              {monthlyRows.map((row) => (
                <div key={row.label} className="flex flex-col items-center gap-2 text-xs text-slate">
                  <div className="flex h-36 items-end gap-1">
                    <div
                      className="w-4 rounded-full bg-moss/70"
                      style={{ height: `${(row.totalIncome / maxValue) * 100}%` }}
                      title={`Income: ${currencySymbol("EUR")} ${row.totalIncome.toFixed(2)}`}
                    />
                    <div
                      className="w-4 rounded-full bg-ember/70"
                      style={{ height: `${(row.expenses / maxValue) * 100}%` }}
                      title={`Expenses: ${currencySymbol("EUR")} ${row.expenses.toFixed(2)}`}
                    />
                  </div>
                  <span>{row.label.slice(0, 3)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-6 text-xs text-slate">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-moss/70" /> Income
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-ember/70" /> Expenses
              </span>
            </div>
          </section>

          <section className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
            <h3 className="font-display text-xl">Monthly breakdown</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.2em] text-haze">
                  <tr>
                    <th className="pb-2">Month</th>
                    <th className="pb-2">Income</th>
                    <th className="pb-2">Expenses</th>
                    <th className="pb-2">Net</th>
                  </tr>
                </thead>
                <tbody className="text-slate">
                  {monthlyRows.map((row) => (
                    <tr key={row.label} className="border-t border-ink/10">
                      <td className="py-3 font-semibold text-ink">{row.label}</td>
                      <td className="py-3">
                        {currencySymbol("EUR")} {row.totalIncome.toFixed(2)}
                      </td>
                      <td className="py-3">
                        {currencySymbol("EUR")} {row.expenses.toFixed(2)}
                      </td>
                      <td className={`py-3 font-semibold ${row.net < 0 ? "text-ember" : "text-ink"}`}>
                        {currencySymbol("EUR")} {row.net.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-ink/20 font-semibold text-ink">
                    <td className="py-3">Total</td>
                    <td className="py-3">
                      {currencySymbol("EUR")} {yearTotals.totalIncome.toFixed(2)}
                    </td>
                    <td className="py-3">
                      {currencySymbol("EUR")} {yearTotals.expenses.toFixed(2)}
                    </td>
                    <td className="py-3">
                      {currencySymbol("EUR")} {yearTotals.net.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
