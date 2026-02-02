import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Company, Invoice, InvoiceTemplate, User } from "../lib/api";
import DashboardHeader from "../components/DashboardHeader";
import DashboardNav from "../components/DashboardNav";
import type { DashboardSection } from "../components/DashboardNav";
import ProfileSection from "../components/ProfileSection";
import CompanySection from "../components/CompanySection";
import InvoiceForm from "../components/InvoiceForm";
import InvoiceTable from "../components/InvoiceTable";
import InvoicePreview from "../components/InvoicePreview";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [companyForm, setCompanyForm] = useState({
    name: "",
    address: "",
    registration_number: "",
  });
  const [companyEditForm, setCompanyEditForm] = useState({
    name: "",
    address: "",
    registration_number: "",
  });
  const [profileForm, setProfileForm] = useState({ address: "" });
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
  const [activeSection, setActiveSection] = useState<DashboardSection>(null);
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
    setProfileForm({ address: result.data.address || "" });
    void loadCompany();
    void loadCompanies();
    void loadInvoices();
    void loadTemplates();
  }

  async function loadCompany() {
    const result = await api.myCompany();
    if (result.ok) {
      setCompany(result.data);
      setCompanyEditForm({
        name: result.data.name,
        address: result.data.address,
        registration_number: result.data.registration_number,
      });
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

  async function loadTemplates() {
    const result = await api.listTemplates();
    if (result.ok) {
      setTemplates(result.data);
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

  async function handleCompanyUpdate() {
    setLoading(true);
    setStatus(null);
    const result = await api.updateCompany({
      name: companyEditForm.name,
      address: companyEditForm.address,
      registration_number: companyEditForm.registration_number,
    });
    setLoading(false);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setCompany(result.data);
    setStatus("Company updated.");
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
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-cloud via-white to-[#FCE6D8] text-ink">
      <div className="relative overflow-hidden">
        <div className="absolute -left-32 -top-28 h-80 w-80 rounded-full bg-ember/20 blur-3xl" />
        <div className="absolute right-0 top-10 h-72 w-72 rounded-full bg-moss/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#FFBE98]/30 blur-3xl" />

        <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-10">
          <DashboardHeader user={user} />

          <DashboardNav activeSection={activeSection} onSelect={setActiveSection} />

          {status && (
            <div className="rounded-2xl border border-ember/30 bg-white/70 px-6 py-4 text-sm text-slate shadow-glow">
              {status}
            </div>
          )}

          {activeSection && (
            <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-6">
                {activeSection === "profile" && (
                  <ProfileSection
                    user={user}
                    profileAddress={profileForm.address}
                    loading={loading}
                    onAddressChange={(value) => setProfileForm({ address: value })}
                    onSave={handleProfileUpdate}
                    onLogout={handleLogout}
                  />
                )}

                {activeSection === "company" && (
                  <CompanySection
                    company={company}
                    form={companyForm}
                    editForm={companyEditForm}
                    loading={loading}
                    onCreateChange={setCompanyForm}
                    onEditChange={setCompanyEditForm}
                    onCreate={handleCompanyCreate}
                    onUpdate={handleCompanyUpdate}
                  />
                )}

                {activeSection === "invoices" && (
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
                {activeSection === "invoices" && (
                  <>
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
