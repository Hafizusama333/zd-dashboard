import type { Aging, Customer, Estimate, Invoice, Job, KPIs } from "./types";

type AnyRec = Record<string, unknown>;

const s = (v: unknown, fallback = ""): string => (v == null ? fallback : String(v));
const n = (v: unknown): number => {
  if (v == null || v === "") return 0;
  const num = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(num) ? num : 0;
};
const pick = <T = unknown>(o: AnyRec, ...keys: string[]): T | undefined => {
  for (const k of keys) {
    const parts = k.split(".");
    let cur: unknown = o;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in (cur as AnyRec)) cur = (cur as AnyRec)[p];
      else { cur = undefined; break; }
    }
    if (cur !== undefined && cur !== null && cur !== "") return cur as T;
  }
  return undefined;
};

// HCP money values often come in cents.
const money = (v: unknown): number => {
  const num = n(v);
  // Heuristic: if it looks like cents (integer >= 1000 with no decimal), divide by 100.
  if (Number.isInteger(num) && Math.abs(num) >= 100) return num / 100;
  return num;
};

const customerName = (o: AnyRec | undefined): string => {
  if (!o) return "—";
  const first = s(pick(o, "first_name"));
  const last = s(pick(o, "last_name"));
  const full = [first, last].filter(Boolean).join(" ").trim();
  return full || s(pick(o, "name", "company"), "—");
};

const addressLine = (o: AnyRec | undefined): string => {
  if (!o) return "—";
  const parts = [
    s(pick(o, "street", "address1", "line1")),
    s(pick(o, "city")),
    s(pick(o, "state")),
  ].filter(Boolean);
  return parts.join(", ") || "—";
};

export function normalizeJob(raw: AnyRec): Job {
  const customer = pick<AnyRec>(raw, "customer") || {};
  const address = pick<AnyRec>(raw, "address", "service_address") || {};
  const assigned = pick<AnyRec[]>(raw, "assigned_employees") || [];
  const tech = assigned.length
    ? `${s(pick(assigned[0], "first_name"))} ${s(pick(assigned[0], "last_name"))}`.trim() || "—"
    : "—";
  const schedule = pick<AnyRec>(raw, "schedule") || {};
  return {
    id: s(pick(raw, "id", "uuid")),
    number: s(pick(raw, "invoice_number", "job_number", "number", "id")),
    customer: customerName(customer),
    address: addressLine(address),
    status: s(pick(raw, "work_status", "status"), "unknown").toLowerCase().replace(/ /g, "_"),
    tech,
    scheduled: (pick(schedule, "scheduled_start", "arrival_window_start") as string) ||
               (pick(raw, "scheduled_start") as string) || null,
    total: pick(raw, "total_amount", "total") !== undefined
      ? money(pick(raw, "total_amount", "total"))
      : null,
  };
}

export function normalizeEstimate(raw: AnyRec): Estimate {
  const customer = pick<AnyRec>(raw, "customer") || {};
  const options = pick<AnyRec[]>(raw, "options") || [];
  const optTotal = options.reduce((acc, opt) => acc + money(pick(opt, "total_amount", "total")), 0);
  return {
    id: s(pick(raw, "id", "uuid")),
    number: s(pick(raw, "estimate_number", "number", "id")),
    customer: customerName(customer),
    status: s(pick(raw, "work_status", "status"), "draft").toLowerCase().replace(/ /g, "_"),
    total: pick(raw, "total_amount", "total") !== undefined
      ? money(pick(raw, "total_amount", "total"))
      : optTotal,
    created: (pick(raw, "created_at", "created") as string) || null,
    updated: (pick(raw, "updated_at", "updated") as string) || null,
  };
}

export function normalizeInvoice(raw: AnyRec, jobCustomerMap?: Map<string, string>): Invoice {
  const customer = pick<AnyRec>(raw, "customer") || {};
  const jobId = s(pick(raw, "job_id"));
  const due = (pick(raw, "due_at", "due_date") as string) || null;
  const daysOverdue = due ? Math.max(0, Math.floor((Date.now() - new Date(due).getTime()) / 86400000)) : 0;
  const linkedCustomer = jobId && jobCustomerMap ? jobCustomerMap.get(jobId) : undefined;
  return {
    id: s(pick(raw, "id", "uuid")),
    number: s(pick(raw, "invoice_number", "number", "id")),
    customer: linkedCustomer || customerName(customer),
    total: money(pick(raw, "due_amount", "amount_due", "balance_due", "amount", "total_amount", "total")),
    due,
    daysOverdue,
    status: s(pick(raw, "status", "payment_status"), "unpaid").toLowerCase().replace(/ /g, "_"),
  };
}

export function normalizeCustomer(raw: AnyRec): Customer {
  const phones = pick<AnyRec[]>(raw, "mobile_numbers", "home_numbers", "work_numbers") || [];
  const phone = phones.length ? s(pick(phones[0], "number")) : s(pick(raw, "phone"));
  const tags = pick<string[] | AnyRec[]>(raw, "tags");
  const tagList: string[] = Array.isArray(tags)
    ? tags.map((t) => (typeof t === "string" ? t : s((t as AnyRec).name)))
    : [];
  return {
    id: s(pick(raw, "id", "uuid")),
    name: `${s(pick(raw, "first_name"))} ${s(pick(raw, "last_name"))}`.trim() || s(pick(raw, "name"), "—"),
    company: s(pick(raw, "company")),
    email: s(pick(raw, "email")),
    phone,
    tags: tagList,
    created: (pick(raw, "created_at", "created") as string) || null,
  };
}

export function computeAging(invoices: Invoice[]): Aging {
  const a: Aging = { current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, days_90_plus: 0 };
  for (const inv of invoices) {
    const d = inv.daysOverdue;
    const amt = inv.total;
    if (d <= 0) a.current += amt;
    else if (d <= 30) a.days_1_30 += amt;
    else if (d <= 60) a.days_31_60 += amt;
    else if (d <= 90) a.days_61_90 += amt;
    else a.days_90_plus += amt;
  }
  return a;
}

export function computeKPIs(args: {
  jobs: Job[];
  estimates: Estimate[];
  ar: Invoice[];
}): KPIs {
  const { jobs, estimates, ar } = args;
  const isComplete = (s: string) => s.startsWith("complete") || s === "completed" || s === "paid";
  const isCancelled = (s: string) => s.includes("cancel");
  const isOpenJob = (s: string) =>
    ["scheduled", "in_progress", "dispatched", "needs_scheduling"].includes(s);
  const isOpenEst = (s: string) =>
    ["pending", "sent", "needs_follow_up", "draft", "scheduled", "needs_scheduling", "in_progress"].includes(s);
  const completed = jobs.filter((j) => isComplete(j.status));
  const cancelled = jobs.filter((j) => isCancelled(j.status));
  const open = jobs.filter((j) => isOpenJob(j.status));
  const openEstimates = estimates.filter((e) => isOpenEst(e.status));
  return {
    total_revenue: completed.reduce((acc, j) => acc + (j.total || 0), 0),
    open_jobs: open.length,
    completed_jobs: completed.length,
    cancelled_jobs: cancelled.length,
    ar_balance: ar.reduce((acc, i) => acc + i.total, 0),
    open_estimates: openEstimates.length,
    pipeline_value: openEstimates.reduce((acc, e) => acc + e.total, 0),
  };
}
