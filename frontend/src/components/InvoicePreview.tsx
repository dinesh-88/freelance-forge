import type { Invoice } from "../lib/api";
import { currencySymbol } from "../lib/currency";

export default function InvoicePreview({
  invoice,
  loading,
  onDownload,
}: {
  invoice: Invoice | null;
  loading: boolean;
  onDownload: () => void;
}) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
      <h3 className="font-display text-xl">Invoice preview</h3>
      {invoice ? (
        <div className="mt-4 space-y-3 text-sm text-slate">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-haze">Invoice</p>
            <span className="text-xs font-semibold text-slate">{invoice.invoice_number}</span>
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-haze">Client</p>
          <p className="text-lg font-semibold text-ink">{invoice.client_name}</p>
          <p className="text-sm text-slate">{invoice.client_address}</p>
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-semibold text-ink">
              {currencySymbol(invoice.currency)} {invoice.total_amount.toFixed(2)}
            </span>
            <span className="text-xs text-haze">{invoice.date}</span>
          </div>
          <div className="rounded-2xl border border-ink/10 bg-white/80 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-haze">Line items</p>
            <div className="mt-3 space-y-2 text-sm text-slate">
              {invoice.items.map((row) => (
                <div key={row.id || row.description} className="flex items-center justify-between">
                  <span>{row.description}</span>
                  <span>
                  {row.use_quantity !== false
                    ? `${row.quantity} × ${row.unit_price}`
                    : `Amount ${row.unit_price}`}{" "}
                  ={" "}
                  {(row.line_total ??
                    (row.use_quantity !== false
                      ? row.quantity * row.unit_price
                      : row.unit_price)
                  ).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-ink/10 bg-white/80 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-haze">User address snapshot</p>
            <p className="mt-2 text-sm text-slate">{invoice.user_address}</p>
          </div>
          <button
            className="w-full rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white shadow-glow"
            onClick={onDownload}
            type="button"
            disabled={loading}
          >
            Download PDF
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate">
          Select an invoice from the table to preview it here.
        </p>
      )}
    </div>
  );
}
