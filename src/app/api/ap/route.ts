import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WEBHOOK_URL =
  "https://zdmaintenance.app.n8n.cloud/webhook/1c405bba-0705-4991-a75b-2a18a2be32fa";

// Raw row shape from the n8n webhook (Google Sheet). Keys are the sheet's
// own column names — several are placeholder gibberish, mapped by meaning below.
type RawRow = {
  row_number?: number;
  adfdfdsafadsfd?: unknown; // submission timestamp
  fasdfdsfdsfsd?: unknown; // contractor name
  fdsf?: unknown; // address
  "Work order number (Número de orden de trabajo)"?: unknown;
  "Amount (cantidad)"?: unknown;
  "Pics sent (fotos enviadas)"?: unknown;
  Paid?: unknown;
  "Column 1"?: unknown;
};

export type APRow = {
  rowNumber: number;
  submitted: string;
  contractor: string;
  address: string;
  wo: string;
  amount: string;
  picsSent: boolean;
  paid: boolean;
};

// Sheet cells can come back as number/boolean/null, not just string.
function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  return /^(yes|true|paid|1)$/i.test(str(v));
}

function normalize(raw: RawRow): APRow {
  return {
    rowNumber: raw.row_number ?? 0,
    submitted: str(raw.adfdfdsafadsfd),
    contractor: str(raw.fasdfdsfdsfsd),
    address: str(raw.fdsf),
    wo: str(raw["Work order number (Número de orden de trabajo)"]),
    amount: str(raw["Amount (cantidad)"]),
    picsSent: toBool(raw["Pics sent (fotos enviadas)"]),
    paid: toBool(raw.Paid),
  };
}

export async function GET() {
  try {
    const res = await fetch(WEBHOOK_URL, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Webhook returned ${res.status}`, rows: [] },
        { status: 502 }
      );
    }
    const data = await res.json();
    const rawRows: RawRow[] = Array.isArray(data) ? data : [data];
    const rows = rawRows.map(normalize).filter((r) => r.contractor || r.wo);
    return NextResponse.json({ rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message, rows: [] }, { status: 502 });
  }
}
