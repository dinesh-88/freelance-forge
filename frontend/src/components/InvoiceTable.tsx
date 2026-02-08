import type { Invoice } from "../lib/api";

export default function InvoiceTable({
  invoices,
  onView,
  onEdit,
  onDownload,
}: {
  invoices: Invoice[];
  onView: (invoice: Invoice) => void;
  onEdit: (invoice: Invoice) => void;
  onDownload: (invoice: Invoice) => void;
}) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-lift">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl">Invoices</h3>
        <span className="text-xs text-haze">{invoices.length} total</span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.2em] text-haze">
            <tr>
              <th className="pb-2">Invoice #</th>
              <th className="pb-2">Client</th>
              <th className="pb-2">Amount</th>
              <th className="pb-2">Date</th>
              <th className="pb-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="text-slate">
            {invoices.map((item) => (
              <tr key={item.id} className="border-t border-ink/10">
                <td className="py-3 text-xs font-semibold text-slate">
                  {item.invoice_number || item.id.slice(0, 8)}
                </td>
                <td className="py-3 font-semibold text-ink">{item.client_name}</td>
                <td className="py-3">
                  {item.currency} {(item.total_amount ?? item.amount).toFixed(2)}
                </td>
                <td className="py-3">{item.date}</td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      className="rounded-lg border border-ink/10 px-3 py-1 text-xs font-semibold"
                      onClick={() => onView(item)}
                      type="button"
                    >
                      View
                    </button>
                    <button
                      className="rounded-lg border border-ink/10 px-3 py-1 text-xs font-semibold"
                      onClick={() => onEdit(item)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="rounded-lg border border-ink/10 px-3 py-1 text-xs font-semibold"
                      onClick={() => onDownload(item)}
                      type="button"
                    >
                      PDF
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td className="py-4 text-sm text-haze" colSpan={5}>
                  No invoices yet. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
