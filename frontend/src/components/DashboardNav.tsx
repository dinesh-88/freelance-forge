export type DashboardSection = "profile" | "company" | "invoices" | null;

export default function DashboardNav({
  activeSection,
  onSelect,
}: {
  activeSection: DashboardSection;
  onSelect: (section: Exclude<DashboardSection, null>) => void;
}) {
  const sections: Array<[Exclude<DashboardSection, null>, string]> = [
    ["profile", "Profile"],
    ["company", "Company"],
    ["invoices", "Invoices"],
  ];

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
    </nav>
  );
}
