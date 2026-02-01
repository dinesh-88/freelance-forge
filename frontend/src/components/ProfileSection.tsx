import type { User } from "../lib/api";

export default function ProfileSection({
  user,
  profileAddress,
  loading,
  onAddressChange,
  onSave,
  onLogout,
}: {
  user: User | null;
  profileAddress: string;
  loading: boolean;
  onAddressChange: (value: string) => void;
  onSave: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-haze">Signed in</p>
            <h2 className="font-display text-2xl text-ink">{user?.email}</h2>
            <p className="text-sm text-slate">Address snapshot: {user?.address || "Missing"}</p>
          </div>
          <button
            className="rounded-xl border border-ink/10 px-4 py-2 text-sm font-semibold"
            onClick={onLogout}
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
          value={profileAddress}
          onChange={(event) => onAddressChange(event.target.value)}
        />
        <button
          className="mt-4 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-glow"
          onClick={onSave}
          type="button"
          disabled={loading}
        >
          Save profile
        </button>
      </div>
    </>
  );
}
