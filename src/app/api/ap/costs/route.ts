import { NextResponse } from "next/server";
import { hcpFetchAll, hcpJobLineItems } from "@/lib/hcp";

export const dynamic = "force-dynamic";

type AnyRec = Record<string, unknown>;

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

// Normalize a street to "<number> <firstword>" for fuzzy matching between the AP
// sheet's free-text addresses and HCP job service addresses.
function streetKey(s: string): string {
  const clean = s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const toks = clean.split(" ");
  return toks.length >= 2 ? `${toks[0]} ${toks[1]}` : clean;
}

// First street line from an AP address cell (rows may list several, newline/comma split).
function apStreetKey(address: string): string {
  const first = address.split("\n")[0].split(",")[0];
  return streetKey(first);
}

// Sum of non-tax line-item unit_price (unit_price * quantity) for a job — the billed
// "Unit price" shown on HCP job line items.
function lineItemsUnitPrice(items: { kind?: string; unit_price?: number; quantity?: number }[]): number {
  let total = 0;
  for (const it of items) {
    if (it.kind === "tax") continue;
    const up = Number(it.unit_price) || 0;
    const qty = Number(it.quantity) || 0;
    // HCP amounts are in cents.
    total += (up >= 100 && Number.isInteger(up) ? up / 100 : up) * qty;
  }
  return total;
}

// Run `fn` over items with at most `limit` in flight at once.
async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchLineItemsWithRetry(jid: string, retries = 2): Promise<{ kind?: string; unit_price?: number; quantity?: number }[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await hcpJobLineItems(jid);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (attempt < retries && /429|Too Many/i.test(msg)) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
}

type JobIndex = {
  newestByStreet: Map<string, { id: string; created: string }>;
  byInvoiceNumber: Map<string, string>; // invoice_number -> jobId (WO# match)
  statusByJob: Map<string, string>; // jobId -> work_status
};

// HCP work_status values that mean the job is finished.
function isCompletedStatus(status: string): boolean {
  return status.startsWith("complete") || status === "completed";
}

// Module-level cache of the job index (5 min TTL). The full /jobs scan is expensive,
// so reuse it across cost requests.
let indexCache: { at: number; idx: JobIndex } | null = null;
const INDEX_TTL = 5 * 60 * 1000;

// AP "WO #" cells map to a job's invoice_number. Take the first token, drop a leading '#'.
function woKey(wo: string): string {
  const first = wo.trim().split(/\s+/)[0] || "";
  return first.replace(/^#/, "");
}

async function getJobIndex(): Promise<JobIndex> {
  if (indexCache && Date.now() - indexCache.at < INDEX_TTL) return indexCache.idx;
  const jobs = await hcpFetchAll<AnyRec>("/jobs", "jobs", 100, 40);
  const newestByStreet = new Map<string, { id: string; created: string }>();
  const byInvoiceNumber = new Map<string, string>();
  const statusByJob = new Map<string, string>();
  for (const j of jobs) {
    const id = str(j.id);
    if (!id) continue;
    statusByJob.set(id, str(j.work_status ?? j.status).toLowerCase());
    const addr = (j.address as AnyRec | undefined) || {};
    const key = streetKey(str(addr.street));
    if (key) {
      const created = str(j.created_at ?? j.created);
      const cur = newestByStreet.get(key);
      if (!cur || created > cur.created) newestByStreet.set(key, { id, created });
    }
    const inv = str(j.invoice_number);
    if (inv && !byInvoiceNumber.has(inv)) byInvoiceNumber.set(inv, id);
  }
  const idx = { newestByStreet, byInvoiceNumber, statusByJob };
  indexCache = { at: Date.now(), idx };
  return idx;
}

type ReqItem = { key: string; address: string; wo: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { items?: unknown };
    const items: ReqItem[] = Array.isArray(body.items)
      ? body.items.map((it) => {
          const o = (it || {}) as AnyRec;
          return { key: str(o.key), address: str(o.address), wo: str(o.wo) };
        }).filter((it) => it.key)
      : [];
    if (items.length === 0) return NextResponse.json({ costs: {}, completed: {} });

    const { newestByStreet, byInvoiceNumber, statusByJob } = await getJobIndex();

    // Resolve each row to the NEWEST job at the row's street address (per the AP report's
    // intent). byInvoiceNumber is kept available for WO# fallback when no address matches.
    const keyToJob = new Map<string, string>();
    for (const it of items) {
      let jid: string | undefined;
      if (it.address) jid = newestByStreet.get(apStreetKey(it.address))?.id;
      if (!jid && it.wo) jid = byInvoiceNumber.get(woKey(it.wo));
      if (jid) keyToJob.set(it.key, jid);
    }

    // Fetch unit price once per unique job (bounded concurrency, retry on 429).
    const uniqueJobIds = Array.from(new Set(keyToJob.values()));
    const priceByJob = new Map<string, number>();
    await mapLimit(uniqueJobIds, 5, async (jid) => {
      try {
        const li = await fetchLineItemsWithRetry(jid);
        priceByJob.set(jid, lineItemsUnitPrice(li));
      } catch {
        // leave unset -> null
      }
    });

    const costs: Record<string, number | null> = {};
    const completed: Record<string, boolean | null> = {};
    for (const it of items) {
      const jid = keyToJob.get(it.key);
      costs[it.key] = jid && priceByJob.has(jid) ? priceByJob.get(jid)! : null;
      completed[it.key] = jid ? isCompletedStatus(statusByJob.get(jid) || "") : null;
    }
    return NextResponse.json({ costs, completed });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message, costs: {}, completed: {} }, { status: 502 });
  }
}
