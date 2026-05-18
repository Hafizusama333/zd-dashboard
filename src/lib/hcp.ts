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
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= pageLimit; page++) {
    const data = await hcpFetch<Record<string, unknown>>(path, {
      params: { page, page_size: pageSize },
    });
    const arr = (data[arrayKey] as T[] | undefined) || [];
    all.push(...arr);
    if (arr.length < pageSize) break;
  }
  return all;
}

export { hcpFetch };
