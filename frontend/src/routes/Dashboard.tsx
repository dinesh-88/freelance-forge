import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Company, Invoice, User } from "../lib/api";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
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
    description: "",
    amount: "",
    currency: "EUR",
    date: new Date().toISOString().slice(0, 10),
  });
  const [invoiceLookupId, setInvoiceLookupId] = useState("");
  const [invoiceResult, setInvoiceResult] = useState<Invoice | null>(null);

  const hasAddress = useMemo(() => Boolean(user?.address), [user]);

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
    const payload = {
      ...invoiceForm,
      amount: Number(invoiceForm.amount || 0),
    };
    const result = await api.createInvoice(payload);
    setLoading(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setInvoiceResult(result.data);
    setStatus("Invoice created.");
  }

  async function handleInvoiceLookup() {
    setLoading(true);
    setStatus(null);
    const result = await api.getInvoice(invoiceLookupId);
    setLoading(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setInvoiceResult(result.data);
    setStatus("Invoice loaded.");
  }

  async function handleInvoiceDownload() {
    if (!invoiceResult) {
      setStatus("Load or create an invoice first.");
      return;
    }
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/invoices/${invoiceResult.id}/pdf`,
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
      link.download = `invoice-${invoiceResult.id}.pdf`;
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

          {status && (
            <div className="rounded-2xl border border-ember/30 bg-white/70 px-6 py-4 text-sm text-slate shadow-glow">
              {status}
            </div>
          )}

          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
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
                <p className="mt-2 text-sm text-slate">Update your address for invoice snapshots.</p>
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

              <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
                <h3 className="font-display text-xl">Create invoice</h3>
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
                    placeholder="Amount"
                    value={invoiceForm.amount}
                    onChange={(event) =>
                      setInvoiceForm({ ...invoiceForm, amount: event.target.value })
                    }
                    type="number"
                    step="0.01"
                  />
                  <input
                    className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                    type="date"
                    value={invoiceForm.date}
                    onChange={(event) =>
                      setInvoiceForm({ ...invoiceForm, date: event.target.value })
                    }
                  />
                  <textarea
                    className="md:col-span-2 rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                    placeholder="Description"
                    rows={3}
                    value={invoiceForm.description}
                    onChange={(event) =>
                      setInvoiceForm({ ...invoiceForm, description: event.target.value })
                    }
                  />
                  <button
                    className="md:col-span-2 rounded-xl bg-ember px-4 py-3 text-sm font-semibold text-white shadow-glow"
                    onClick={handleInvoiceCreate}
                    type="button"
                    disabled={loading || !hasAddress}
                  >
                    Create invoice
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
                <h3 className="font-display text-xl">Lookup invoice</h3>
                <p className="mt-2 text-sm text-slate">
                  Pull a saved invoice by UUID to verify snapshot data.
                </p>
                <input
                  className="mt-4 w-full rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                  placeholder="Invoice ID"
                  value={invoiceLookupId}
                  onChange={(event) => setInvoiceLookupId(event.target.value)}
                />
                <button
                  className="mt-4 w-full rounded-xl border border-ink/10 px-4 py-3 text-sm font-semibold"
                  onClick={handleInvoiceLookup}
                  type="button"
                  disabled={loading}
                >
                  Fetch invoice
                </button>
              </div>

              <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
                <h3 className="font-display text-xl">Invoice preview</h3>
                {invoiceResult ? (
                  <div className="mt-4 space-y-3 text-sm text-slate">
                    <p className="text-xs uppercase tracking-[0.2em] text-haze">Client</p>
                    <p className="text-lg font-semibold text-ink">{invoiceResult.client_name}</p>
                    <p>{invoiceResult.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-semibold text-ink">
                        {invoiceResult.currency} {invoiceResult.amount.toFixed(2)}
                      </span>
                      <span className="text-xs text-haze">{invoiceResult.date}</span>
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
                    No invoice loaded yet. Create one or paste an ID above.
                  </p>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
