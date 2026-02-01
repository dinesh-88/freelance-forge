import type { Company, Invoice } from "../lib/api";

export default function InvoiceForm({
  invoiceForm,
  companies,
  hasAddress,
  invoiceMode,
  loading,
  invoiceTotal,
  onChange,
  onCreate,
  onUpdate,
  onNew,
}: {
  invoiceForm: {
    client_name: string;
    client_address: string;
    currency: string;
    date: string;
    items: { description: string; quantity: number; unit_price: number }[];
  };
  companies: Company[];
  hasAddress: boolean;
  invoiceMode: "create" | "edit";
  loading: boolean;
  invoiceTotal: number;
  onChange: (next: {
    client_name: string;
    client_address: string;
    currency: string;
    date: string;
    items: { description: string; quantity: number; unit_price: number }[];
  }) => void;
  onCreate: () => void;
  onUpdate: () => void;
  onNew: () => void;
}) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-xl">
          {invoiceMode === "create" ? "Create invoice" : "Edit invoice"}
        </h3>
        <button
          className="rounded-xl border border-ink/10 px-4 py-2 text-sm font-semibold"
          onClick={onNew}
          type="button"
        >
          New invoice
        </button>
      </div>
      {!hasAddress && (
        <p className="mt-2 text-sm text-ember">
          Add your address during registration to create invoices.
        </p>
      )}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="text-xs uppercase tracking-[0.2em] text-haze">
            Client company
          </label>
          <select
            className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
            value={companies.find((item) => item.name === invoiceForm.client_name)?.id || ""}
            onChange={(event) => {
              const selected = companies.find((item) => item.id === event.target.value);
              if (!selected) {
                onChange({ ...invoiceForm, client_name: "", client_address: "" });
                return;
              }
              onChange({
                ...invoiceForm,
                client_name: selected.name,
                client_address: selected.address,
              });
            }}
          >
            <option value="">Select existing company</option>
            {companies.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.registration_number}
              </option>
            ))}
          </select>
        </div>
        <input
          className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
          placeholder="Client name"
          value={invoiceForm.client_name}
          onChange={(event) =>
            onChange({ ...invoiceForm, client_name: event.target.value })
          }
        />
        <input
          className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
          placeholder="Client address"
          value={invoiceForm.client_address}
          onChange={(event) =>
            onChange({ ...invoiceForm, client_address: event.target.value })
          }
        />
        <select
          className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
          value={invoiceForm.currency}
          onChange={(event) => onChange({ ...invoiceForm, currency: event.target.value })}
        >
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
        </select>
        <input
          className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
          type="date"
          value={invoiceForm.date}
          onChange={(event) => onChange({ ...invoiceForm, date: event.target.value })}
        />
        <div className="md:col-span-2 rounded-2xl border border-ink/10 bg-white/80 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-haze">Line items</p>
            <button
              className="rounded-lg border border-ink/10 px-3 py-1 text-xs font-semibold"
              onClick={() =>
                onChange({
                  ...invoiceForm,
                  items: [
                    ...invoiceForm.items,
                    { description: "", quantity: 1, unit_price: 0 },
                  ],
                })
              }
              type="button"
            >
              Add row
            </button>
          </div>
          <div className="mt-3 grid gap-3">
            {invoiceForm.items.map((item, index) => (
              <div
                key={`${index}-${item.description}`}
                className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]"
              >
                <input
                  className="rounded-xl border border-ink/10 bg-white/80 px-3 py-2"
                  placeholder="Description"
                  value={item.description}
                  onChange={(event) => {
                    const next = [...invoiceForm.items];
                    next[index] = { ...next[index], description: event.target.value };
                    onChange({ ...invoiceForm, items: next });
                  }}
                />
                <input
                  className="rounded-xl border border-ink/10 bg-white/80 px-3 py-2"
                  type="number"
                  step="0.01"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(event) => {
                    const next = [...invoiceForm.items];
                    next[index] = {
                      ...next[index],
                      quantity: Number(event.target.value),
                    };
                    onChange({ ...invoiceForm, items: next });
                  }}
                />
                <input
                  className="rounded-xl border border-ink/10 bg-white/80 px-3 py-2"
                  type="number"
                  step="0.01"
                  placeholder="Unit price"
                  value={item.unit_price}
                  onChange={(event) => {
                    const next = [...invoiceForm.items];
                    next[index] = {
                      ...next[index],
                      unit_price: Number(event.target.value),
                    };
                    onChange({ ...invoiceForm, items: next });
                  }}
                />
                <button
                  className="rounded-xl border border-ink/10 px-3 py-2 text-xs font-semibold"
                  onClick={() => {
                    const next = invoiceForm.items.filter((_, i) => i !== index);
                    onChange({
                      ...invoiceForm,
                      items:
                        next.length > 0
                          ? next
                          : [{ description: "", quantity: 1, unit_price: 0 }],
                    });
                  }}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-haze">Total</span>
            <span className="font-semibold text-ink">
              {invoiceForm.currency} {invoiceTotal.toFixed(2)}
            </span>
          </div>
        </div>
        {invoiceMode === "create" ? (
          <button
            className="md:col-span-2 rounded-xl bg-ember px-4 py-3 text-sm font-semibold text-white shadow-glow"
            onClick={onCreate}
            type="button"
            disabled={loading || !hasAddress}
          >
            Create invoice
          </button>
        ) : (
          <button
            className="md:col-span-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-glow"
            onClick={onUpdate}
            type="button"
            disabled={loading || !hasAddress}
          >
            Save changes
          </button>
        )}
      </div>
    </div>
  );
}
