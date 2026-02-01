import type { Company } from "../lib/api";

export default function CompanySection({
  company,
  form,
  editForm,
  loading,
  onCreateChange,
  onEditChange,
  onCreate,
  onUpdate,
}: {
  company: Company | null;
  form: { name: string; address: string; registration_number: string };
  editForm: { name: string; address: string; registration_number: string };
  loading: boolean;
  onCreateChange: (next: { name: string; address: string; registration_number: string }) => void;
  onEditChange: (next: { name: string; address: string; registration_number: string }) => void;
  onCreate: () => void;
  onUpdate: () => void;
}) {
  return (
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
        <div className="mt-4 grid gap-4">
          <input
            className="w-full rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
            placeholder="Company name"
            value={editForm.name}
            onChange={(event) =>
              onEditChange({ ...editForm, name: event.target.value })
            }
          />
          <input
            className="w-full rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
            placeholder="Registration number"
            value={editForm.registration_number}
            onChange={(event) =>
              onEditChange({
                ...editForm,
                registration_number: event.target.value,
              })
            }
          />
          <textarea
            className="w-full rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
            placeholder="Company address"
            rows={3}
            value={editForm.address}
            onChange={(event) =>
              onEditChange({ ...editForm, address: event.target.value })
            }
          />
          <button
            className="rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-glow"
            onClick={onUpdate}
            type="button"
            disabled={loading}
          >
            Update company
          </button>
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          <input
            className="w-full rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
            placeholder="Company name"
            value={form.name}
            onChange={(event) =>
              onCreateChange({ ...form, name: event.target.value })
            }
          />
          <input
            className="w-full rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
            placeholder="Registration number"
            value={form.registration_number}
            onChange={(event) =>
              onCreateChange({
                ...form,
                registration_number: event.target.value,
              })
            }
          />
          <textarea
            className="w-full rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
            placeholder="Company address"
            rows={3}
            value={form.address}
            onChange={(event) =>
              onCreateChange({ ...form, address: event.target.value })
            }
          />
          <button
            className="rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-glow"
            onClick={onCreate}
            type="button"
            disabled={loading}
          >
            Save company
          </button>
        </div>
      )}
    </div>
  );
}
