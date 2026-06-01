import { NextResponse } from "next/server";
import { fetchInbox, gmailConfigured } from "@/lib/gmail";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!gmailConfigured()) {
    return NextResponse.json({
      stub: true,
      reason:
        "Gmail not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD to .env.local and restart to enable the live email audit.",
      emails: [],
    });
  }
  try {
    const emails = await fetchInbox(40);
    return NextResponse.json({ stub: false, emails });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "email fetch failed", emails: [] },
      { status: 502 },
    );
  }
}
