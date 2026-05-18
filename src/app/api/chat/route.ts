import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ChatBody = {
  system?: string;
  message: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Partial<ChatBody>;
  const message = body.message?.trim();
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({
      reply:
        "AI chat is not configured yet. Add ANTHROPIC_API_KEY to .env.local and restart the server to enable live AI responses.",
      stub: true,
    });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: body.system || "You are a helpful business intelligence assistant.",
        messages: [{ role: "user", content: message }],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Anthropic ${res.status}: ${text.slice(0, 300)}` }, { status: 502 });
    }
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const reply = data.content?.[0]?.text || "No response.";
    return NextResponse.json({ reply });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "chat failed" },
      { status: 500 },
    );
  }
}
