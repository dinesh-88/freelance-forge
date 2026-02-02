import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Company, User } from "../lib/api";
import DashboardHeader from "../components/DashboardHeader";
import DashboardNav from "../components/DashboardNav";
import type { DashboardSection } from "../components/DashboardNav";
import ProfileSection from "../components/ProfileSection";
import CompanySection from "../components/CompanySection";

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
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
  const [activeSection, setActiveSection] = useState<DashboardSection>(null);

  const hasAddress = useMemo(() => Boolean(user?.address), [user]);

  useEffect(() => {
    void loadSession();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get("section");
    if (section === "profile" || section === "company") {
      setActiveSection(section);
    }
  }, [location.search]);

  async function loadSession() {
    const result = await api.me();
    if (!result.ok) {
      navigate("/", { replace: true });
      return;
    }
    setUser(result.data);
    setProfileForm({ address: result.data.address || "" });
    void loadCompany();
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-cloud via-white to-[#E6F6F5] text-ink">
      <div className="relative overflow-hidden">
        <div className="absolute -left-32 -top-28 h-80 w-80 rounded-full bg-ember/20 blur-3xl" />
        <div className="absolute right-0 top-10 h-72 w-72 rounded-full bg-moss/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#C7EFEB]/30 blur-3xl" />

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

                {!hasAddress && activeSection === "profile" && (
                  <p className="text-sm text-ember">Add your address to create invoices.</p>
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
