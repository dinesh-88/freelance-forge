import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Company, Invoice, InvoiceTemplate, User } from "../lib/api";
import DashboardHeader from "../components/DashboardHeader";
import DashboardNav from "../components/DashboardNav";
import InvoiceForm from "../components/InvoiceForm";
import InvoiceTable from "../components/InvoiceTable";
import InvoicePreview from "../components/InvoicePreview";

export default function Invoices() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [invoiceForm, setInvoiceForm] = useState({
    company_id: "",
    template_id: "",
    client_name: "",
    client_address: "",
    currency: "EUR",
    date: new Date().toISOString().slice(0, 10),
    items: [
      { id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0, use_quantity: true },
    ],
  });
  const [invoiceResult, setInvoiceResult] = useState<Invoice | null>(null);
  const [invoiceMode, setInvoiceMode] = useState<"create" | "edit">("create");
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  const hasAddress = useMemo(() => Boolean(user?.address), [user]);
  const invoiceTotal = useMemo(
    () =>
      invoiceForm.items.reduce(
        (sum, item) =>
          sum +
          (item.use_quantity
            ? Number(item.quantity || 0) * Number(item.unit_price || 0)
            : Number(item.unit_price || 0)),
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
    void loadCompanies();
    void loadInvoices();
    void loadTemplates();
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

  async function loadTemplates() {
    const result = await api.listTemplates();
    if (result.ok) {
      setTemplates(result.data);
    }
  }

  async function handleInvoiceCreate() {
    setLoading(true);
    setStatus(null);
    if (!invoiceForm.company_id) {
      setLoading(false);
      setStatus("Select a client company.");
      return;
    }
    if (!invoiceForm.items.length) {
      setLoading(false);
      setStatus("Add at least one line item.");
      return;
    }
    const payload = {
      company_id: invoiceForm.company_id,
      template_id: invoiceForm.template_id || undefined,
      client_name: invoiceForm.client_name,
      client_address: invoiceForm.client_address,
      currency: invoiceForm.currency,
      date: invoiceForm.date,
      items: invoiceForm.items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price || 0),
        use_quantity: item.use_quantity,
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
    setShowForm(true);
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
      company_id: invoiceForm.company_id || undefined,
      template_id: invoiceForm.template_id || undefined,
      client_name: invoiceForm.client_name || undefined,
      client_address: invoiceForm.client_address || undefined,
      currency: invoiceForm.currency || undefined,
      date: invoiceForm.date || undefined,
      items: invoiceForm.items.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price || 0),
        use_quantity: item.use_quantity,
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

  function handleInvoiceEdit(invoice: Invoice) {
    setInvoiceMode("edit");
    setEditingInvoiceId(invoice.id);
    setInvoiceForm({
      company_id: invoice.company_id || "",
      template_id: invoice.template_id || "",
      client_name: invoice.client_name,
      client_address: invoice.client_address || "",
      currency: invoice.currency,
      date: invoice.date,
      items: invoice.items?.length
        ? invoice.items.map((row) => ({
            id: crypto.randomUUID(),
            description: row.description,
            quantity: row.quantity,
            unit_price: row.unit_price,
            use_quantity: row.use_quantity ?? true,
          }))
        : [
            { id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0, use_quantity: true },
          ],
    });
    setInvoiceResult(invoice);
    setShowForm(true);
  }

  function handleInvoiceNew() {
    setInvoiceMode("create");
    setEditingInvoiceId(null);
    setInvoiceForm({
      company_id: "",
      template_id: "",
      client_name: "",
      client_address: "",
      currency: "EUR",
      date: new Date().toISOString().slice(0, 10),
      items: [
        { id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0, use_quantity: true },
      ],
    });
    setShowForm(true);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cloud via-white to-[#FCE6D8] text-ink">
      <div className="relative overflow-hidden">
        <div className="absolute -left-32 -top-28 h-80 w-80 rounded-full bg-ember/20 blur-3xl" />
        <div className="absolute right-0 top-10 h-72 w-72 rounded-full bg-moss/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#FFBE98]/30 blur-3xl" />

        <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-10">
          <DashboardHeader user={user} />

          <DashboardNav
            activeSection={null}
            onSelect={(section) => navigate(`/app?section=${section}`)}
          />

          {status && (
            <div className="rounded-2xl border border-ember/30 bg-white/70 px-6 py-4 text-sm text-slate shadow-glow">
              {status}
            </div>
          )}

          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl">Invoices</h2>
                <button
                  className="rounded-xl bg-ember px-4 py-2 text-sm font-semibold text-white shadow-glow"
                  onClick={handleInvoiceNew}
                  type="button"
                >
                  Create invoice
                </button>
              </div>
              {showForm && (
                <InvoiceForm
                  invoiceForm={invoiceForm}
                  companies={companies}
                  templates={templates}
                  hasAddress={hasAddress}
                  invoiceMode={invoiceMode}
                  loading={loading}
                  invoiceTotal={invoiceTotal}
                  onChange={setInvoiceForm}
                  onCreate={handleInvoiceCreate}
                  onUpdate={handleInvoiceUpdate}
                  onNew={handleInvoiceNew}
                />
              )}
            </div>

            <div className="space-y-6">
              <InvoiceTable
                invoices={invoices}
                onView={setInvoiceResult}
                onEdit={handleInvoiceEdit}
                onDownload={handleInvoiceDownload}
              />
              <InvoicePreview
                invoice={invoiceResult}
                loading={loading}
                onDownload={() => handleInvoiceDownload()}
              />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
