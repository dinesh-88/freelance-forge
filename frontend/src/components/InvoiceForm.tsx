import { useState } from "react";
import { api } from "../lib/api";
import type { Company, InvoiceTemplate } from "../lib/api";
import { currencySymbol } from "../lib/currency";

export default function InvoiceForm({
  invoiceForm,
  companies,
  templates,
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
    company_id: string;
    template_id: string;
    client_name: string;
    client_address: string;
    currency: string;
    date: string;
    items: {
      id: string;
      description: string;
      quantity: number;
      unit_price: number;
      use_quantity: boolean;
    }[];
  };
  companies: Company[];
  templates: InvoiceTemplate[];
  hasAddress: boolean;
  invoiceMode: "create" | "edit";
  loading: boolean;
  invoiceTotal: number;
  onChange: (next: {
    company_id: string;
    template_id: string;
    client_name: string;
    client_address: string;
    currency: string;
    date: string;
    items: {
      id: string;
      description: string;
      quantity: number;
      unit_price: number;
      use_quantity: boolean;
    }[];
  }) => void;
  onCreate: () => void;
  onUpdate: () => void;
  onNew: () => void;
}) {
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [lastLoadingId, setLastLoadingId] = useState<string | null>(null);

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
            Template
          </label>
          <select
            className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
            value={invoiceForm.template_id}
            onChange={(event) =>
              onChange({ ...invoiceForm, template_id: event.target.value })
            }
          >
            <option value="">Default template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs uppercase tracking-[0.2em] text-haze">
            Client company
          </label>
          <select
            className="mt-2 w-full rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
            value={invoiceForm.company_id}
            onChange={(event) => {
              const selected = companies.find((item) => item.id === event.target.value);
              if (!selected) {
                onChange({ ...invoiceForm, company_id: "", client_name: "", client_address: "" });
                return;
              }
              onChange({
                ...invoiceForm,
                company_id: selected.id,
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
          readOnly={Boolean(invoiceForm.company_id)}
          onChange={(event) =>
            onChange({ ...invoiceForm, client_name: event.target.value })
          }
        />
        <input
          className="rounded-xl border border-ink/10 bg-white/80 px-4 py-3"
          placeholder="Client address"
          value={invoiceForm.client_address}
          readOnly={Boolean(invoiceForm.company_id)}
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
                    {
                      id: crypto.randomUUID(),
                      description: "",
                      quantity: 1,
                      unit_price: 0,
                      use_quantity: true,
                    },
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
                key={item.id}
                className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]"
              >
                <div className="flex items-center gap-2">
                  <input
                    className="w-full rounded-xl border border-ink/10 bg-white/80 px-3 py-2"
                    placeholder="Description"
                    value={item.description}
                    onChange={(event) => {
                      const next = [...invoiceForm.items];
                      next[index] = { ...next[index], description: event.target.value };
                      onChange({ ...invoiceForm, items: next });
                    }}
                  />
                  <button
                    className="rounded-lg border border-ink/10 px-3 py-2 text-xs font-semibold"
                    type="button"
                    disabled={lastLoadingId === item.id}
                    onClick={async () => {
                      setAiError(null);
                      setLastLoadingId(item.id);
                      const result = await api.lastLineItem();
                      setLastLoadingId(null);
                      if (!result.ok) {
                        setAiError(result.error);
                        return;
                      }
                      const last = result.data.description;
                      if (!last) {
                        setAiError("No previous line-item found.");
                        return;
                      }
                      const now = new Date();
                      const month = now.toLocaleString("en-US", { month: "long" });
                      const year = String(now.getFullYear());
                      const monthRegex = /January|February|March|April|May|June|July|August|September|October|November|December/g;
                      const nextDescription = last
                        .replace(monthRegex, month)
                        .replace(/\b20\d{2}\b/g, year);
                      const next = [...invoiceForm.items];
                      next[index] = { ...next[index], description: nextDescription };
                      onChange({ ...invoiceForm, items: next });
                    }}
                  >
                    {lastLoadingId === item.id ? "Using..." : "Last"}
                  </button>
                  <button
                    className="rounded-lg border border-ink/10 px-3 py-2 text-xs font-semibold"
                    type="button"
                    disabled={aiLoadingId === item.id || !item.description.trim()}
                    onClick={async () => {
                      setAiError(null);
                      setAiLoadingId(item.id);
                      const result = await api.improveLineItem({
                        description: item.description,
                      });
                      setAiLoadingId(null);
                      if (!result.ok) {
                        setAiError(result.error);
                        return;
                      }
                      const next = [...invoiceForm.items];
                      next[index] = { ...next[index], description: result.data.suggestion };
                      onChange({ ...invoiceForm, items: next });
                    }}
                  >
                    {aiLoadingId === item.id ? "Improving..." : "AI"}
                  </button>
                </div>
                <input
                  className="rounded-xl border border-ink/10 bg-white/80 px-3 py-2"
                  type="number"
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
                  placeholder={item.use_quantity ? "Unit price" : "Amount"}
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
                <div className="flex items-center justify-between md:col-span-4">
                  <label className="flex items-center gap-2 text-xs text-haze">
                    <input
                      type="checkbox"
                      checked={item.use_quantity}
                      onChange={(event) => {
                        const next = [...invoiceForm.items];
                        next[index] = {
                          ...next[index],
                          use_quantity: event.target.checked,
                          quantity: event.target.checked ? next[index].quantity : 1,
                        };
                        onChange({ ...invoiceForm, items: next });
                      }}
                    />
                    Use qty × unit
                  </label>
                  <button
                    className="rounded-xl border border-ink/10 px-3 py-2 text-xs font-semibold"
                    onClick={() => {
                      const next = invoiceForm.items.filter((_, i) => i !== index);
                      onChange({
                        ...invoiceForm,
                        items:
                          next.length > 0
                            ? next
                            : [
                                {
                                  id: crypto.randomUUID(),
                                  description: "",
                                  quantity: 1,
                                  unit_price: 0,
                                  use_quantity: true,
                                },
                              ],
                      });
                    }}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          {aiError && (
            <p className="mt-3 text-xs text-ember">
              {aiError}
            </p>
          )}
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-haze">Total</span>
            <span className="font-semibold text-ink">
              {currencySymbol(invoiceForm.currency)} {invoiceTotal.toFixed(2)}
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
