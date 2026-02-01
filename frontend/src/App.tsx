import { useEffect, useMemo, useState } from "react";

type User = {
  id: string;
  email: string;
  address?: string | null;
  company_id?: string | null;
  created_at: string;
};

type Company = {
  id: string;
  name: string;
  address: string;
  created_at: string;
};

type Invoice = {
  id: string;
  client_name: string;
  description: string;
  amount: number;
  currency: string;
  user_address: string;
  date: string;
};

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function fetchJson<T>(path: string, options?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
      ...options,
    });

    if (!res.ok) {
      const message = await res.text();
      return { ok: false, error: message || `Request failed (${res.status})` };
    }

    const contentType = res.headers.get("content-type") || "";
    if (res.status === 204 || !contentType.includes("application/json")) {
      return { ok: true, data: undefined as T };
    }

    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [registerForm, setRegisterForm] = useState({
    email: "",
    password: "",
    address: "",
  });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });

  const [companyForm, setCompanyForm] = useState({ name: "", address: "" });

  const [invoiceForm, setInvoiceForm] = useState({
    client_name: "",
    description: "",
    amount: "",
    currency: "USD",
    date: new Date().toISOString().slice(0, 10),
  });

  const [invoiceLookupId, setInvoiceLookupId] = useState("");
  const [invoiceResult, setInvoiceResult] = useState<Invoice | null>(null);

  const hasAddress = useMemo(() => Boolean(user?.address), [user]);

  useEffect(() => {
    void loadSession();
  }, []);

  async function loadSession() {
    const result = await fetchJson<User>("/auth/me");
    if (result.ok) {
      setUser(result.data);
      void loadCompany();
    }
  }

  async function loadCompany() {
    const result = await fetchJson<Company>("/company/me");
    if (result.ok) {
      setCompany(result.data);
    }
  }

  async function handleRegister() {
    setLoading(true);
    setStatus(null);
    const payload = {
      email: registerForm.email,
      password: registerForm.password,
      address: registerForm.address || null,
    };

    const result = await fetchJson<{ user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    setLoading(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setUser(result.data.user);
    setStatus("Welcome aboard. Session started.");
  }

  async function handleLogin() {
    setLoading(true);
    setStatus(null);
    const result = await fetchJson<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(loginForm),
    });
    setLoading(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setUser(result.data.user);
    setStatus("Logged in.");
    void loadCompany();
  }

  async function handleLogout() {
    setLoading(true);
    setStatus(null);
    const result = await fetchJson<void>("/auth/logout", { method: "POST" });
    setLoading(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setUser(null);
    setCompany(null);
    setInvoiceResult(null);
    setStatus("Logged out.");
  }

  async function handleCompanyCreate() {
    setLoading(true);
    setStatus(null);
    const result = await fetchJson<Company>("/company", {
      method: "POST",
      body: JSON.stringify(companyForm),
    });
    setLoading(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setCompany(result.data);
    setStatus("Company onboarded.");
  }

  async function handleInvoiceCreate() {
    setLoading(true);
    setStatus(null);
    const payload = {
      ...invoiceForm,
      amount: Number(invoiceForm.amount || 0),
    };

    const result = await fetchJson<Invoice>("/invoices", {
      method: "POST",
      body: JSON.stringify(payload),
    });

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
    const result = await fetchJson<Invoice>(`/invoices/${invoiceLookupId}`);
    setLoading(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setInvoiceResult(result.data);
    setStatus("Invoice loaded.");
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
                Polished onboarding, invoices, and identity in one workspace.
              </h1>
              <p className="max-w-2xl text-base text-slate">
                Manage your company profile, capture user address snapshots on invoices, and keep
                every contract on record with a secure session workflow.
              </p>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-white/70 bg-white/60 px-5 py-4 shadow-lift backdrop-blur">
              <div className="h-10 w-10 rounded-full bg-ember/20" />
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-haze">API</p>
                <p className="text-sm font-semibold text-ink">{API_BASE}</p>
              </div>
            </div>
          </header>

          {status && (
            <div className="rounded-2xl border border-ember/30 bg-white/70 px-6 py-4 text-sm text-slate shadow-glow">
              {status}
            </div>
          )}

          {!user ? (
            <section className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-3xl border border-white/70 bg-white/80 p-8 shadow-lift backdrop-blur">
                <div className="flex gap-4 text-sm font-semibold">
                  <button
                    className={`rounded-full px-4 py-2 transition ${
                      activeTab === "login"
                        ? "bg-ink text-white"
                        : "border border-ink/10 text-slate"
                    }`}
                    onClick={() => setActiveTab("login")}
                    type="button"
                  >
                    Login
                  </button>
                  <button
                    className={`rounded-full px-4 py-2 transition ${
                      activeTab === "register"
                        ? "bg-ink text-white"
                        : "border border-ink/10 text-slate"
                    }`}
                    onClick={() => setActiveTab("register")}
                    type="button"
                  >
                    Register
                  </button>
                </div>

                {activeTab === "login" ? (
                  <div className="mt-8 space-y-5">
                    <div>
                      <label className="text-xs uppercase tracking-[0.2em] text-haze">Email</label>
                      <input
                        className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                        value={loginForm.email}
                        onChange={(event) =>
                          setLoginForm({ ...loginForm, email: event.target.value })
                        }
                        placeholder="you@studio.com"
                        type="email"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.2em] text-haze">Password</label>
                      <input
                        className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                        value={loginForm.password}
                        onChange={(event) =>
                          setLoginForm({ ...loginForm, password: event.target.value })
                        }
                        placeholder="••••••••"
                        type="password"
                      />
                    </div>
                    <button
                      className="w-full rounded-xl bg-ink px-4 py-3 font-semibold text-white shadow-glow transition hover:translate-y-[-1px]"
                      onClick={handleLogin}
                      type="button"
                      disabled={loading}
                    >
                      {loading ? "Working..." : "Login"}
                    </button>
                  </div>
                ) : (
                  <div className="mt-8 space-y-5">
                    <div>
                      <label className="text-xs uppercase tracking-[0.2em] text-haze">Email</label>
                      <input
                        className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                        value={registerForm.email}
                        onChange={(event) =>
                          setRegisterForm({ ...registerForm, email: event.target.value })
                        }
                        placeholder="you@studio.com"
                        type="email"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.2em] text-haze">Password</label>
                      <input
                        className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                        value={registerForm.password}
                        onChange={(event) =>
                          setRegisterForm({ ...registerForm, password: event.target.value })
                        }
                        placeholder="Set a secure password"
                        type="password"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.2em] text-haze">Address</label>
                      <textarea
                        className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                        value={registerForm.address}
                        onChange={(event) =>
                          setRegisterForm({ ...registerForm, address: event.target.value })
                        }
                        placeholder="Your billing address"
                        rows={3}
                      />
                    </div>
                    <button
                      className="w-full rounded-xl bg-ember px-4 py-3 font-semibold text-white shadow-glow transition hover:translate-y-[-1px]"
                      onClick={handleRegister}
                      type="button"
                      disabled={loading}
                    >
                      {loading ? "Working..." : "Create account"}
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-ink/10 bg-[#15171C] p-8 text-white shadow-lift">
                <h2 className="font-display text-2xl">What you can do</h2>
                <ul className="mt-6 space-y-4 text-sm text-white/70">
                  <li className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    Capture a reusable company profile in seconds.
                  </li>
                  <li className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    Lock invoice snapshots with user address data.
                  </li>
                  <li className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    Use secure sessions ready for OAuth or OIDC.
                  </li>
                </ul>
              </div>
            </section>
          ) : (
            <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-6">
                <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-haze">Signed in</p>
                      <h2 className="font-display text-2xl text-ink">{user.email}</h2>
                      <p className="text-sm text-slate">
                        Address snapshot: {user.address || "Missing"}
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
                      placeholder="Currency"
                      value={invoiceForm.currency}
                      onChange={(event) =>
                        setInvoiceForm({ ...invoiceForm, currency: event.target.value })
                      }
                    />
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
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate">
                      No invoice loaded yet. Create one or paste an ID above.
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
