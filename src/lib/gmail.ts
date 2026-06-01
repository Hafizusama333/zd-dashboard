// Gmail inbox reader (server-side only) via IMAP + App Password.
// Plain Gmail passwords no longer work — requires a 16-char App Password
// (Google account → Security → 2-Step Verification → App passwords).
// Env: GMAIL_USER (full address), GMAIL_APP_PASSWORD (16 chars, spaces stripped).
import { ImapFlow } from "imapflow";

export type InboundEmail = {
  uid: number;
  from: string;
  fromEmail: string;
  subject: string;
  date: string | null;
  snippet: string;
  seen: boolean;
  ageHours: number;
};

const HOST = "imap.gmail.com";
const PORT = 993;

export function gmailConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

const parseFrom = (raw: string): { name: string; email: string } => {
  // "Display Name <addr@x.com>" or bare "addr@x.com"
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || m[2].trim(), email: m[2].trim().toLowerCase() };
  return { name: raw.trim(), email: raw.trim().toLowerCase() };
};

const hoursSince = (d: Date | null): number => {
  if (!d) return 0;
  const t = d.getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (Date.now() - t) / 3600000);
};

// Fetch the most recent `limit` inbound messages from INBOX, newest envelope first.
export async function fetchInbox(limit = 40): Promise<InboundEmail[]> {
  const user = process.env.GMAIL_USER as string;
  const pass = (process.env.GMAIL_APP_PASSWORD as string).replace(/\s/g, "");
  const client = new ImapFlow({
    host: HOST,
    port: PORT,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  await client.connect();
  const out: InboundEmail[] = [];
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const box = client.mailbox;
      const total = typeof box === "object" && box ? box.exists : 0;
      if (!total) return [];
      // Fetch the last `limit` UIDs by sequence range.
      const start = Math.max(1, total - limit + 1);
      const range = `${start}:*`;
      for await (const msg of client.fetch(range, {
        uid: true,
        envelope: true,
        flags: true,
        bodyStructure: false,
      })) {
        const env = msg.envelope;
        const fromRaw = env?.from?.[0];
        const fromStr = fromRaw
          ? `${fromRaw.name || ""} <${fromRaw.address || ""}>`.trim()
          : "Unknown";
        const parsed = parseFrom(fromStr);
        const date = env?.date ? new Date(env.date) : null;
        out.push({
          uid: msg.uid,
          from: parsed.name,
          fromEmail: parsed.email,
          subject: env?.subject || "(no subject)",
          date: date ? date.toISOString() : null,
          snippet: "",
          seen: !!msg.flags?.has("\\Seen"),
          ageHours: hoursSince(date),
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  // Oldest first = longest waiting at the top (client priority).
  return out.sort((a, b) => b.ageHours - a.ageHours);
}
