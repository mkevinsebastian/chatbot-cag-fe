import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const sessionId = body?.sessionId;
  const message = body?.message;
  const productCode = body?.productCode;

  if (!sessionId || !message || !productCode) {
    return NextResponse.json(
      { message: "Bad Request: sessionId, message, productCode wajib diisi" },
      { status: 400 }
    );
  }

  const webhook = process.env.N8N_WEBHOOK_URL;
  if (!webhook) {
    return NextResponse.json(
      { message: "N8N_WEBHOOK_URL belum diset di .env.local" },
      { status: 500 }
    );
  }

  try {
    const n8nRes = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, message, productCode })
    });

    const text = await n8nRes.text();
    let payload: any = null;
    try { payload = JSON.parse(text); } catch { /* biarkan text mentah */ }

    if (!n8nRes.ok) {
      // n8n biasanya balas {code,message}. Propagasi ke FE
      return NextResponse.json(
        { message: "n8n error", n8n: payload ?? text },
        { status: 500 }
      );
    }

    // Harapkan n8n membalas { answer: "..." }
    const answer =
      payload?.answer ??
      payload?.message ??
      "Tidak ada jawaban dari n8n.";

    return NextResponse.json({ answer }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { message: "Gagal menghubungi n8n", error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
