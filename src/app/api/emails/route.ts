import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WEBHOOK_URL =
  "https://zdmaintenance.app.n8n.cloud/webhook/bb1b9e56-e4b7-41b2-9004-24342214bcd4";

type RawLabel = { id?: string; name?: string };

// Raw message from the n8n Gmail webhook. Keys mirror the Gmail API metadata.
// Only Subject/From/To/labels are guaranteed by the sample; the rest are
// best-effort and tolerated as missing.
type RawPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: RawPart[];
};

type RawEmail = {
  id?: string;
  threadId?: string;
  Subject?: unknown;
  From?: unknown;
  To?: unknown;
  Date?: unknown;
  date?: unknown;
  internalDate?: unknown;
  snippet?: unknown;
  sizeEstimate?: unknown;
  payload?: RawPart;
  labels?: RawLabel[];
  labelIds?: string[];
};

export type LiveEmail = {
  uid: number;
  id: string;
  threadId: string;
  from: string;
  fromEmail: string;
  to: string;
  subject: string;
  snippet: string;
  body: string; // plain-text body when the webhook includes it, else snippet
  date: string | null;
  seen: boolean;
  ageHours: number;
  sizeEstimate: number;
  labels: string[];
};

// Gmail bodies are base64url. Walk the MIME tree preferring text/plain.
function decodeB64Url(data: string): string {
  try {
    const norm = data.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(norm, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function extractBody(part: RawPart | undefined): string {
  if (!part) return "";
  const plain = findPart(part, "text/plain");
  if (plain) return plain;
  const html = findPart(part, "text/html");
  // Strip tags so the UI can render readable text.
  if (html) return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return "";
}

function findPart(part: RawPart, mime: string): string {
  if (part.mimeType === mime && part.body?.data) return decodeB64Url(part.body.data);
  for (const p of part.parts ?? []) {
    const found = findPart(p, mime);
    if (found) return found;
  }
  return "";
}

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

// "Property Meld <noreply@msg.propertymeld.com>" -> name + email.
function splitFrom(raw: string): { name: string; email: string } {
  const m = raw.match(/^(.*?)<([^>]+)>\s*$/);
  if (m) {
    const name = m[1].replace(/["']/g, "").trim();
    const email = m[2].trim();
    return { name: name || email, email };
  }
  return { name: raw, email: raw.includes("@") ? raw : "" };
}

function labelNames(raw: RawEmail): string[] {
  if (Array.isArray(raw.labels)) {
    return raw.labels.map((l) => str(l?.name) || str(l?.id)).filter(Boolean);
  }
  if (Array.isArray(raw.labelIds)) return raw.labelIds.map(str).filter(Boolean);
  return [];
}

function parseDate(raw: RawEmail): Date | null {
  // internalDate is epoch millis (string); Date/date are RFC strings.
  const internal = str(raw.internalDate);
  if (internal && /^\d+$/.test(internal)) {
    const d = new Date(parseInt(internal, 10));
    if (!Number.isNaN(d.getTime())) return d;
  }
  const ds = str(raw.Date) || str(raw.date);
  if (ds) {
    const d = new Date(ds);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function normalize(raw: RawEmail, i: number, now: number): LiveEmail {
  const labels = labelNames(raw);
  const seen = !labels.some((l) => /^unread$/i.test(l));
  const { name, email } = splitFrom(str(raw.From));
  const d = parseDate(raw);
  const ageHours = d ? Math.max(0, (now - d.getTime()) / 3_600_000) : 0;
  const snippet = str(raw.snippet);
  const body = extractBody(raw.payload) || snippet;
  const size = Number(raw.sizeEstimate);
  return {
    uid: i,
    id: str(raw.id),
    threadId: str(raw.threadId),
    from: name,
    fromEmail: email,
    to: str(raw.To),
    subject: str(raw.Subject),
    snippet,
    body,
    date: d ? d.toISOString() : null,
    seen,
    ageHours,
    sizeEstimate: Number.isNaN(size) ? 0 : size,
    labels,
  };
}

export async function GET() {
  try {
    const res = await fetch(WEBHOOK_URL, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Webhook returned ${res.status}`, emails: [] },
        { status: 502 }
      );
    }
    const data = await res.json();
    // n8n returns an error object when the workflow is misconfigured.
    if (!Array.isArray(data) && (data?.code !== undefined || data?.message)) {
      return NextResponse.json(
        { error: `Webhook: ${str(data.message) || "no data"}`, emails: [] },
        { status: 502 }
      );
    }
    const raw: RawEmail[] = Array.isArray(data) ? data : [data];
    const now = Date.now();
    const emails = raw
      .map((r, i) => normalize(r, i, now))
      .filter((e) => e.subject || e.from);
    return NextResponse.json({ stub: false, emails });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "email fetch failed", emails: [] },
      { status: 502 }
    );
  }
}
