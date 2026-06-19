// HousecallPro API client (server-side only).
// Docs: https://docs.housecallpro.com/

const BASE = process.env.HCP_BASE_URL || "https://api.housecallpro.com";
const KEY = process.env.HCP_API_KEY || "";

type FetchOpts = { params?: Record<string, string | number | undefined>; pageLimit?: number };

async function hcpFetch<T = unknown>(path: string, opts: FetchOpts = {}): Promise<T> {
  if (!KEY) throw new Error("HCP_API_KEY missing");
  const url = new URL(path.startsWith("http") ? path : `${BASE}${path}`);
  if (opts.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Token ${KEY}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HCP ${res.status} ${res.statusText} on ${path}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// Generic paginator. HCP returns { jobs: [...], page, page_size, total_pages } shape (varies per resource).
// We pull the array under `arrayKey` and follow page param until empty or pageLimit hit.
export async function hcpFetchAll<T = unknown>(
  path: string,
  arrayKey: string,
  pageSize = 100,
  pageLimit = 10,
  extraParams?: Record<string, string | number | undefined>,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= pageLimit; page++) {
    const data = await hcpFetch<Record<string, unknown>>(path, {
      params: { page, page_size: pageSize, ...extraParams },
    });
    const arr = (data[arrayKey] as T[] | undefined) || [];
    all.push(...arr);
    if (arr.length < pageSize) break;
  }
  return all;
}

// HCP returns jobs/estimates/invoices newest-first by created_at. For period KPIs we only
// need records whose relevant date >= the window start. Page newest-first and stop once a
// whole page falls entirely before `sinceISO` (minus a buffer, because completed_at can lag
// created_at). `dateOf` extracts the record's relevant date. Always pulls at least one page.
export async function hcpFetchSince<T = unknown>(
  path: string,
  arrayKey: string,
  sinceISO: string,
  dateOf: (rec: T) => string | null | undefined,
  pageSize = 100,
  pageLimit = 50,
  bufferDays = 14,
): Promise<T[]> {
  const cutoff = new Date(sinceISO).getTime() - bufferDays * 86400000;
  const all: T[] = [];
  for (let page = 1; page <= pageLimit; page++) {
    const data = await hcpFetch<Record<string, unknown>>(path, {
      params: { page, page_size: pageSize },
    });
    const arr = (data[arrayKey] as T[] | undefined) || [];
    all.push(...arr);
    if (arr.length < pageSize) break;
    // Stop if every record on this page predates the cutoff (older pages only go further back).
    const newest = arr.reduce((max, rec) => {
      const d = dateOf(rec);
      const t = d ? new Date(d).getTime() : NaN;
      return Number.isFinite(t) && t > max ? t : max;
    }, -Infinity);
    if (Number.isFinite(newest) && newest < cutoff) break;
  }
  return all;
}

// Jobs whose SCHEDULED date falls in [minDate, maxDate] with the given work statuses,
// using HCP's server-side filters. This is exactly how the "Job revenue earned" report
// scopes jobs, so summing subtotal over the result matches the report figure.
// Dates are YYYY-MM-DD (inclusive on both ends, per HCP).
export async function hcpFetchJobsScheduled<T = unknown>(
  minDate: string,
  maxDate: string,
  workStatuses: string[],
  pageSize = 100,
  pageLimit = 50,
): Promise<T[]> {
  if (!KEY) throw new Error("HCP_API_KEY missing");
  const all: T[] = [];
  for (let page = 1; page <= pageLimit; page++) {
    const url = new URL(`${BASE}/jobs`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(pageSize));
    url.searchParams.set("scheduled_start_min", minDate);
    url.searchParams.set("scheduled_start_max", maxDate);
    // work_status is a repeated array param: work_status[]=completed
    for (const ws of workStatuses) url.searchParams.append("work_status[]", ws);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Token ${KEY}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HCP ${res.status} on /jobs (scheduled): ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as Record<string, unknown>;
    const arr = (data.jobs as T[] | undefined) || [];
    all.push(...arr);
    const totalPages = Number(data.total_pages) || 1;
    if (arr.length < pageSize || page >= totalPages) break;
  }
  return all;
}

export type HCPLineItem = {
  id: string;
  name: string;
  description?: string;
  kind: string;
  unit_cost: number;
  unit_price: number;
  quantity: number;
  amount: number;
};

export async function hcpJobLineItems(jobId: string): Promise<HCPLineItem[]> {
  const data = await hcpFetch<{ data?: HCPLineItem[] }>(`/jobs/${jobId}/line_items`);
  return data.data || [];
}

export { hcpFetch };
