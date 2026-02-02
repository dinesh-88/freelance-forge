export type User = {
  id: string;
  email: string;
  address?: string | null;
  company_id?: string | null;
  created_at: string;
};

export type Company = {
  id: string;
  name: string;
  address: string;
  registration_number: string;
  created_at: string;
};

export type Invoice = {
  id: string;
  company_id?: string | null;
  user_id?: string | null;
  template_id?: string | null;
  client_name: string;
  client_address: string;
  description: string;
  amount: number;
  currency: string;
  user_address: string;
  total_amount: number;
  date: string;
  items: LineItem[];
};

export type LineItem = {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total?: number;
  use_quantity?: boolean;
};

export type InvoiceTemplate = {
  id: string;
  name: string;
  html: string;
};
type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function fetchJson<T>(path: string, options?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
      ...options,
    });

    if (!res.ok) {
      const message = await res.text();
      return { ok: false, error: message || `Request failed (${res.status})` };
    }

    const contentType = res.headers.get("content-type") || "";
    if (res.status === 204 || !contentType.includes("application/json")) {
      return { ok: true, data: undefined as T };
    }

    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

export const api = {
  me: () => fetchJson<User>("/auth/me"),
  login: (payload: { email: string; password: string }) =>
    fetchJson<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  register: (payload: { email: string; password: string; address?: string | null }) =>
    fetchJson<{ user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  logout: () => fetchJson<void>("/auth/logout", { method: "POST" }),
  updateProfile: (payload: { address?: string | null }) =>
    fetchJson<User>("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  myCompany: () => fetchJson<Company>("/company/me"),
  listCompanies: () => fetchJson<Company[]>("/company"),
  createCompany: (payload: { name: string; address: string; registration_number: string }) =>
    fetchJson<Company>("/company", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCompany: (payload: {
    name?: string;
    address?: string;
    registration_number?: string;
  }) =>
    fetchJson<Company>("/company", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  createInvoice: (payload: {
    company_id: string;
    template_id?: string | null;
    client_name: string;
    client_address: string;
    currency: string;
    date: string;
    items: Array<{
      description: string;
      quantity: number;
      unit_price: number;
      use_quantity?: boolean;
    }>;
  }) =>
    fetchJson<Invoice>("/invoices", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listInvoices: () => fetchJson<Invoice[]>("/invoices"),
  updateInvoice: (
    id: string,
    payload: Partial<{
      company_id: string;
      template_id?: string | null;
      client_name: string;
      client_address: string;
      currency: string;
      date: string;
      items: Array<{
        description: string;
        quantity: number;
        unit_price: number;
        use_quantity?: boolean;
      }>;
    }>
  ) =>
    fetchJson<Invoice>(`/invoices/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  getInvoice: (id: string) => fetchJson<Invoice>(`/invoices/${id}`),
  listTemplates: () => fetchJson<InvoiceTemplate[]>("/invoice-templates"),
  createTemplate: (payload: { name: string; html: string }) =>
    fetchJson<InvoiceTemplate>("/invoice-templates", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateTemplate: (id: string, payload: { name: string; html: string }) =>
    fetchJson<InvoiceTemplate>(`/invoice-templates/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteTemplate: (id: string) =>
    fetchJson<void>(`/invoice-templates/${id}`, {
      method: "DELETE",
    }),
};
