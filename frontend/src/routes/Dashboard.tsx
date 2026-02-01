import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Company, Invoice, User } from "../lib/api";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [companyForm, setCompanyForm] = useState({
    name: "",
    address: "",
    registration_number: "",
  });
  const [profileForm, setProfileForm] = useState({ address: "" });
  const [invoiceForm, setInvoiceForm] = useState({
    client_name: "",
    client_address: "",
    currency: "EUR",
    date: new Date().toISOString().slice(0, 10),
    items: [{ description: "", quantity: 1, unit_price: 0 }],
  });
  const [invoiceResult, setInvoiceResult] = useState<Invoice | null>(null);
  const [activeSection, setActiveSection] = useState<
    "profile" | "company" | "invoices" | null
  >(null);
  const [invoiceMode, setInvoiceMode] = useState<"create" | "edit">("create");
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  const hasAddress = useMemo(() => Boolean(user?.address), [user]);
  const invoiceTotal = useMemo(
    () =>
      invoiceForm.items.reduce(
        (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
        0
      ),
    [invoiceForm.items]
  );

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
    setProfileForm({ address: result.data.address || "" });
    void loadCompany();
    void loadCompanies();
    void loadInvoices();
  }

  async function loadCompany() {
    const result = await api.myCompany();
    if (result.ok) {
      setCompany(result.data);
    }
  }

  async function loadCompanies() {
    const result = await api.listCompanies();
    if (result.ok) {
      setCompanies(result.data);
    }
  }

  async function loadInvoices() {
    const result = await api.listInvoices();
    if (result.ok) {
      setInvoices(result.data);
    }
  }

  async function handleLogout() {
    setLoading(true);
    setStatus(null);
    const result = await api.logout();
    setLoading(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    navigate("/", { replace: true });
  }

  async function handleCompanyCreate() {
    setLoading(true);
    setStatus(null);
    const result = await api.createCompany(companyForm);
    setLoading(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setCompany(result.data);
    setStatus("Company onboarded.");
    void loadCompanies();
  }

  async function handleProfileUpdate() {
    setLoading(true);
    setStatus(null);
    const result = await api.updateProfile({ address: profileForm.address || null });
    setLoading(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setUser(result.data);
    setStatus("Profile updated.");
  }

  async function handleInvoiceCreate() {
    setLoading(true);
    setStatus(null);
    if (!invoiceForm.items.length) {
      setLoading(false);
      setStatus("Add at least one line item.");
      return;
    }
    const payload = {
      client_name: invoiceForm.client_name,
      client_address: invoiceForm.client_address,
      currency: invoiceForm.currency,
      date: invoiceForm.date,
      items: invoiceForm.items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price || 0),
      })),
    };
    const result = await api.createInvoice(payload);
    setLoading(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setInvoiceResult(result.data);
    setStatus("Invoice created.");
    setInvoiceMode("edit");
    setEditingInvoiceId(result.data.id);
    void loadInvoices();
  }

  async function handleInvoiceUpdate() {
    if (!editingInvoiceId) {
      setStatus("Select an invoice to edit.");
      return;
    }
    setLoading(true);
    setStatus(null);
    const result = await api.updateInvoice(editingInvoiceId, {
      client_name: invoiceForm.client_name || undefined,
      client_address: invoiceForm.client_address || undefined,
      currency: invoiceForm.currency || undefined,
      date: invoiceForm.date || undefined,
      items: invoiceForm.items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price || 0),
      })),
    });
    setLoading(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setInvoiceResult(result.data);
    setStatus("Invoice updated.");
    void loadInvoices();
  }

  async function handleInvoiceDownload(target?: Invoice) {
    const invoice = target ?? invoiceResult;
    if (!invoice) {
      setStatus("Select an invoice first.");
      return;
    }
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/invoices/${invoice.id}/pdf`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const message = await res.text();
        setStatus(message || `Failed to download (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoice-${invoice.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Download failed");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cloud via-white to-[#FCE6D8] text-ink">
      <div className="relative overflow-hidden">
        <div className="absolute -left-32 -top-28 h-80 w-80 rounded-full bg-ember/20 blur-3xl" />
        <div className="absolute right-0 top-10 h-72 w-72 rounded-full bg-moss/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#FFBE98]/30 blur-3xl" />

        <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-10">
          <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ember">
                Freelance Forge
              </p>
              <h1 className="font-display text-3xl font-semibold text-ink md:text-4xl">
                Dashboard
              </h1>
              <p className="max-w-2xl text-base text-slate">
                Keep company records, profile updates, and invoices in sync.
              </p>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-white/70 bg-white/60 px-5 py-4 shadow-lift backdrop-blur">
              <div className="h-10 w-10 rounded-full bg-ember/20" />
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-haze">Session</p>
                <p className="text-sm font-semibold text-ink">{user?.email}</p>
              </div>
            </div>
          </header>

          <nav className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-slate shadow-lift">
            {(
              [
                ["profile", "Profile"],
                ["company", "Company"],
                ["invoices", "Invoices"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                className={`rounded-full px-3 py-1 transition ${
                  activeSection === key ? "bg-ink text-white" : "hover:bg-ink/10"
                }`}
                onClick={() => setActiveSection(key)}
                type="button"
              >
                {label}
              </button>
            ))}
          </nav>

          {status && (
            <div className="rounded-2xl border border-ember/30 bg-white/70 px-6 py-4 text-sm text-slate shadow-glow">
              {status}
            </div>
          )}

          {activeSection && (
          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              {activeSection === "profile" && (
                <>
                  <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-haze">Signed in</p>
                        <h2 className="font-display text-2xl text-ink">{user?.email}</h2>
                        <p className="text-sm text-slate">
                          Address snapshot: {user?.address || "Missing"}
                        </p>
                      </div>
                      <button
                        className="rounded-xl border border-ink/10 px-4 py-2 text-sm font-semibold"
                        onClick={handleLogout}
                        type="button"
                        disabled={loading}
                      >
                        Logout
                      </button>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
                    <h3 className="font-display text-xl">Profile</h3>
                    <p className="mt-2 text-sm text-slate">
                      Update your address for invoice snapshots.
                    </p>
                    <textarea
                      className="mt-4 w-full rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                      rows={3}
                      placeholder="Your billing address"
                      value={profileForm.address}
                      onChange={(event) => setProfileForm({ address: event.target.value })}
                    />
                    <button
                      className="mt-4 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-glow"
                      onClick={handleProfileUpdate}
                      type="button"
                      disabled={loading}
                    >
                      Save profile
                    </button>
                  </div>
                </>
              )}

              {activeSection === "company" && (
              <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl">Company onboarding</h3>
                  {company ? (
                    <span className="rounded-full bg-moss/10 px-3 py-1 text-xs font-semibold text-moss">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-ember/10 px-3 py-1 text-xs font-semibold text-ember">
                      Pending
                    </span>
                  )}
                </div>

                {company ? (
                  <div className="mt-4 rounded-2xl border border-ink/10 bg-white/80 p-4">
                    <p className="text-lg font-semibold text-ink">{company.name}</p>
                    <p className="text-sm text-slate">{company.address}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-haze">
                      Reg: {company.registration_number}
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 grid gap-4">
                    <input
                      className="w-full rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                      placeholder="Company name"
                      value={companyForm.name}
                      onChange={(event) =>
                        setCompanyForm({ ...companyForm, name: event.target.value })
                      }
                    />
                    <input
                      className="w-full rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                      placeholder="Registration number"
                      value={companyForm.registration_number}
                      onChange={(event) =>
                        setCompanyForm({
                          ...companyForm,
                          registration_number: event.target.value,
                        })
                      }
                    />
                    <textarea
                      className="w-full rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                      placeholder="Company address"
                      rows={3}
                      value={companyForm.address}
                      onChange={(event) =>
                        setCompanyForm({ ...companyForm, address: event.target.value })
                      }
                    />
                    <button
                      className="rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-glow"
                      onClick={handleCompanyCreate}
                      type="button"
                      disabled={loading}
                    >
                      Save company
                    </button>
                  </div>
                )}
              </div>
              )}

              {activeSection === "invoices" && (
              <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-display text-xl">
                    {invoiceMode === "create" ? "Create invoice" : "Edit invoice"}
                  </h3>
                  <button
                    className="rounded-xl border border-ink/10 px-4 py-2 text-sm font-semibold"
                    onClick={() => {
                      setInvoiceMode("create");
                      setEditingInvoiceId(null);
                      setInvoiceForm({
                        client_name: "",
                        client_address: "",
                        currency: "EUR",
                        date: new Date().toISOString().slice(0, 10),
                        items: [{ description: "", quantity: 1, unit_price: 0 }],
                      });
                    }}
                    type="button"
                  >
                    New invoice
                  </button>
                </div>
                {!hasAddress && (
                  <p className="mt-2 text-sm text-ember">
                    Add your address during registration to create invoices.
                  </p>
                )}
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="text-xs uppercase tracking-[0.2em] text-haze">
                      Client company
                    </label>
                    <select
                      className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                      value={invoiceForm.client_name}
                      onChange={(event) =>
                        setInvoiceForm({
                          ...invoiceForm,
                          client_name: event.target.value,
                        })
                      }
                    >
                      <option value="">Select existing company</option>
                      {companies.map((item) => (
                        <option key={item.id} value={item.name}>
                          {item.name} · {item.registration_number}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                    placeholder="Client name"
                    value={invoiceForm.client_name}
                    onChange={(event) =>
                      setInvoiceForm({ ...invoiceForm, client_name: event.target.value })
                    }
                  />
                  <input
                    className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                    placeholder="Client address"
                    value={invoiceForm.client_address}
                    onChange={(event) =>
                      setInvoiceForm({ ...invoiceForm, client_address: event.target.value })
                    }
                  />
                  <select
                    className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                    value={invoiceForm.currency}
                    onChange={(event) =>
                      setInvoiceForm({ ...invoiceForm, currency: event.target.value })
                    }
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                  <input
                    className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                    type="date"
                    value={invoiceForm.date}
                    onChange={(event) =>
                      setInvoiceForm({ ...invoiceForm, date: event.target.value })
                    }
                  />
                  <div className="md:col-span-2 rounded-2xl border border-ink/10 bg-white/80 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.2em] text-haze">Line items</p>
                      <button
                        className="rounded-lg border border-ink/10 px-3 py-1 text-xs font-semibold"
                        onClick={() =>
                          setInvoiceForm({
                            ...invoiceForm,
                            items: [
                              ...invoiceForm.items,
                              { description: "", quantity: 1, unit_price: 0 },
                            ],
                          })
                        }
                        type="button"
                      >
                        Add row
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3">
                      {invoiceForm.items.map((item, index) => (
                        <div
                          key={`${index}-${item.description}`}
                          className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]"
                        >
                          <input
                            className="rounded-xl border border-ink/10 bg-white/80 px-3 py-2"
                            placeholder="Description"
                            value={item.description}
                            onChange={(event) => {
                              const next = [...invoiceForm.items];
                              next[index] = {
                                ...next[index],
                                description: event.target.value,
                              };
                              setInvoiceForm({ ...invoiceForm, items: next });
                            }}
                          />
                          <input
                            className="rounded-xl border border-ink/10 bg-white/80 px-3 py-2"
                            type="number"
                            step="0.01"
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(event) => {
                              const next = [...invoiceForm.items];
                              next[index] = {
                                ...next[index],
                                quantity: Number(event.target.value),
                              };
                              setInvoiceForm({ ...invoiceForm, items: next });
                            }}
                          />
                          <input
                            className="rounded-xl border border-ink/10 bg-white/80 px-3 py-2"
                            type="number"
                            step="0.01"
                            placeholder="Unit price"
                            value={item.unit_price}
                            onChange={(event) => {
                              const next = [...invoiceForm.items];
                              next[index] = {
                                ...next[index],
                                unit_price: Number(event.target.value),
                              };
                              setInvoiceForm({ ...invoiceForm, items: next });
                            }}
                          />
                          <button
                            className="rounded-xl border border-ink/10 px-3 py-2 text-xs font-semibold"
                            onClick={() => {
                              const next = invoiceForm.items.filter((_, i) => i !== index);
                              setInvoiceForm({
                                ...invoiceForm,
                                items:
                                  next.length > 0
                                    ? next
                                    : [{ description: "", quantity: 1, unit_price: 0 }],
                              });
                            }}
                            type="button"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="text-haze">Total</span>
                      <span className="font-semibold text-ink">
                        {invoiceForm.currency} {invoiceTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  {invoiceMode === "create" ? (
                    <button
                      className="md:col-span-2 rounded-xl bg-ember px-4 py-3 text-sm font-semibold text-white shadow-glow"
                      onClick={handleInvoiceCreate}
                      type="button"
                      disabled={loading || !hasAddress}
                    >
                      Create invoice
                    </button>
                  ) : (
                    <button
                      className="md:col-span-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-glow"
                      onClick={handleInvoiceUpdate}
                      type="button"
                      disabled={loading || !hasAddress}
                    >
                      Save changes
                    </button>
                  )}
                </div>
              </div>
              )}
            </div>

            <div className="space-y-6">
              {activeSection === "invoices" && (
                <>
                  <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-xl">Invoices</h3>
                      <span className="text-xs text-haze">{invoices.length} total</span>
                    </div>
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs uppercase tracking-[0.2em] text-haze">
                          <tr>
                            <th className="pb-2">Client</th>
                            <th className="pb-2">Amount</th>
                            <th className="pb-2">Date</th>
                            <th className="pb-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="text-slate">
                          {invoices.map((item) => (
                            <tr key={item.id} className="border-t border-ink/10">
                              <td className="py-3 font-semibold text-ink">{item.client_name}</td>
                              <td className="py-3">
                                {item.currency} {(item.total_amount ?? item.amount).toFixed(2)}
                              </td>
                              <td className="py-3">{item.date}</td>
                              <td className="py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    className="rounded-lg border border-ink/10 px-3 py-1 text-xs font-semibold"
                                    onClick={() => setInvoiceResult(item)}
                                    type="button"
                                  >
                                    View
                                  </button>
                                  <button
                                    className="rounded-lg border border-ink/10 px-3 py-1 text-xs font-semibold"
                                    onClick={() => {
                                      setInvoiceMode("edit");
                                      setEditingInvoiceId(item.id);
                                      setInvoiceForm({
                                        client_name: item.client_name,
                                        client_address: item.client_address || "",
                                        currency: item.currency,
                                        date: item.date,
                                        items: item.items?.length
                                          ? item.items.map((row) => ({
                                              description: row.description,
                                              quantity: row.quantity,
                                              unit_price: row.unit_price,
                                            }))
                                          : [{ description: "", quantity: 1, unit_price: 0 }],
                                      });
                                      setInvoiceResult(item);
                                    }}
                                    type="button"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="rounded-lg border border-ink/10 px-3 py-1 text-xs font-semibold"
                                    onClick={() => handleInvoiceDownload(item)}
                                    type="button"
                                  >
                                    PDF
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {invoices.length === 0 && (
                            <tr>
                              <td className="py-4 text-sm text-haze" colSpan={4}>
                                No invoices yet. Create one to get started.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
                    <h3 className="font-display text-xl">Invoice preview</h3>
                    {invoiceResult ? (
                      <div className="mt-4 space-y-3 text-sm text-slate">
                        <p className="text-xs uppercase tracking-[0.2em] text-haze">Client</p>
                        <p className="text-lg font-semibold text-ink">{invoiceResult.client_name}</p>
                        <p className="text-sm text-slate">{invoiceResult.client_address}</p>
                        <div className="flex items-center justify-between">
                          <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-semibold text-ink">
                            {invoiceResult.currency} {invoiceResult.total_amount.toFixed(2)}
                          </span>
                          <span className="text-xs text-haze">{invoiceResult.date}</span>
                        </div>
                        <div className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-haze">
                            Line items
                          </p>
                          <div className="mt-3 space-y-2 text-sm text-slate">
                            {invoiceResult.items.map((row) => (
                              <div
                                key={row.id || row.description}
                                className="flex items-center justify-between"
                              >
                                <span>{row.description}</span>
                                <span>
                                  {row.quantity} × {row.unit_price} ={" "}
                                  {(row.line_total ?? row.quantity * row.unit_price).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-ink/10 bg-white/80 p-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-haze">
                            User address snapshot
                          </p>
                          <p className="mt-2 text-sm text-slate">{invoiceResult.user_address}</p>
                        </div>
                        <button
                          className="w-full rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-glow"
                          onClick={handleInvoiceDownload}
                          type="button"
                          disabled={loading}
                        >
                          Download PDF
                        </button>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-slate">
                        Select an invoice from the table to preview it here.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>
          )}
        </main>
      </div>
    </div>
  );
}
