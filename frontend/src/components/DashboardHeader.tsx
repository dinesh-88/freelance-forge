import type { User } from "../lib/api";

export default function DashboardHeader({ user }: { user: User | null }) {
  return (
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
  );
}
