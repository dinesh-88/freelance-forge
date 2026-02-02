import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { InvoiceTemplate } from "../lib/api";
import logo from "../assets/logo.svg";

export default function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", html: "" });

  useEffect(() => {
    void loadTemplates();
  }, []);

  async function loadTemplates() {
    const result = await api.listTemplates();
    if (!result.ok) {
      navigate("/", { replace: true });
      return;
    }
    setTemplates(result.data);
  }

  async function handleSave() {
    setLoading(true);
    setStatus(null);
    const result = editingId
      ? await api.updateTemplate(editingId, form)
      : await api.createTemplate(form);
    setLoading(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    if (editingId) {
      setTemplates((prev) => prev.map((t) => (t.id === result.data.id ? result.data : t)));
    } else {
      setTemplates((prev) => [result.data, ...prev]);
    }
    setForm({ name: "", html: "" });
    setEditingId(null);
    setStatus(editingId ? "Template updated." : "Template created.");
  }

  async function handleDelete(id: string) {
    setLoading(true);
    setStatus(null);
    const result = await api.deleteTemplate(id);
    setLoading(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setForm({ name: "", html: "" });
    }
    setStatus("Template deleted.");
  }

  function handleSelect(template: InvoiceTemplate) {
    setEditingId(template.id);
    setForm({
      name: template.name,
      html: template.html,
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cloud via-white to-[#E6F6F5] text-ink">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Freelance Forge" className="h-10 w-10" />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-ember">Freelance Forge</p>
              <h1 className="font-display text-3xl">Invoice Templates</h1>
            </div>
          </div>
          <Link
            to="/app"
            className="rounded-xl border border-ink/10 px-4 py-2 text-sm font-semibold"
          >
            Back to dashboard
          </Link>
        </header>

        {status && (
          <div className="rounded-2xl border border-ember/30 bg-white/70 px-6 py-4 text-sm text-slate shadow-glow">
            {status}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
            <h2 className="font-display text-xl">Templates</h2>
            <div className="mt-4 space-y-2">
              {templates.length === 0 && <p className="text-sm text-haze">No templates yet.</p>}
              {templates.map((template) => (
                <div key={template.id} className="flex items-center justify-between">
                  <button
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                      editingId === template.id
                        ? "border-ink bg-ink text-white"
                        : "border-ink/10"
                    }`}
                    onClick={() => handleSelect(template)}
                    type="button"
                  >
                    {template.name}
                  </button>
                  <button
                    className="rounded-lg border border-ink/10 px-3 py-1 text-xs font-semibold"
                    onClick={() => handleDelete(template.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
            <h2 className="font-display text-xl">{editingId ? "Edit" : "Create"} template</h2>
            <div className="mt-4 grid gap-3">
              <input
                className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                placeholder="Name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
              <textarea
                className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
                placeholder="HTML template (Handlebars)"
                rows={12}
                value={form.html}
                onChange={(event) => setForm({ ...form, html: event.target.value })}
              />
              <button
                className="rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-glow"
                onClick={handleSave}
                type="button"
                disabled={loading}
              >
                {editingId ? "Update template" : "Create template"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
