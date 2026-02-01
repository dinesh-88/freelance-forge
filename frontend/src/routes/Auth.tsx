import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export default function Auth() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [registerForm, setRegisterForm] = useState({
    email: "",
    password: "",
    address: "",
  });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });

  async function handleRegister() {
    setLoading(true);
    setStatus(null);
    const result = await api.register({
      email: registerForm.email,
      password: registerForm.password,
      address: registerForm.address || null,
    });
    setLoading(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setStatus("Welcome aboard. Session started.");
    navigate("/app", { replace: true });
  }

  async function handleLogin() {
    setLoading(true);
    setStatus(null);
    const result = await api.login(loginForm);
    setLoading(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setStatus("Logged in.");
    navigate("/app", { replace: true });
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
          </header>

          {status && (
            <div className="rounded-2xl border border-ember/30 bg-white/70 px-6 py-4 text-sm text-slate shadow-glow">
              {status}
            </div>
          )}

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
        </main>
      </div>
    </div>
  );
}
