import { Link, useLocation } from "react-router-dom";

export type DashboardSection = "profile" | "company" | null;

export default function DashboardNav({
  activeSection,
  onSelect,
}: {
  activeSection: DashboardSection;
  onSelect: (section: Exclude<DashboardSection, null>) => void;
}) {
  const location = useLocation();
  const sections: Array<[Exclude<DashboardSection, null>, string]> = [
    ["profile", "Profile"],
    ["company", "Company"],
  ];
  const isTemplates = location.pathname.startsWith("/app/templates");
  const isInvoices = location.pathname.startsWith("/app/invoices");
  const isReports = location.pathname.startsWith("/app/reports");

  return (
    <nav className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-slate shadow-lift">
      {sections.map(([key, label]) => (
        <button
          key={key}
          className={`rounded-full px-3 py-1 transition ${
            activeSection === key ? "bg-ink text-white" : "hover:bg-ink/10"
          }`}
          onClick={() => onSelect(key)}
          type="button"
        >
          {label}
        </button>
      ))}
      <Link
        className={`rounded-full px-3 py-1 transition ${
          isInvoices ? "bg-ink text-white" : "hover:bg-ink/10"
        }`}
        to="/app/invoices"
      >
        Invoices
      </Link>
      <Link
        className={`rounded-full px-3 py-1 transition ${
          isReports ? "bg-ink text-white" : "hover:bg-ink/10"
        }`}
        to="/app/reports"
      >
        Reports
      </Link>
      <Link
        className={`rounded-full px-3 py-1 transition ${
          isTemplates ? "bg-ink text-white" : "hover:bg-ink/10"
        }`}
        to="/app/templates"
      >
        Templates
      </Link>
    </nav>
  );
}
