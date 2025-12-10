import { NextRequest, NextResponse } from "next/server";

const TIMEOUT_MS = 60_000; // 60 detik timeout

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const body = await req.json();
    const { sessionId, message } = body;

    // 1. SIAPKAN PAYLOAD UNTUK N8N
    // Kita ubah 'message' jadi 'question' agar sesuai dengan node Normalisasi n8n
    const n8nPayload = {
      sessionId,
      question: message,  // <--- PENTING
      productCode: body.productCode || null // Opsional jika nanti mau filter per produk
    };

    // 2. KIRIM KE N8N
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) throw new Error("URL Webhook belum disetting di .env");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-request-id": requestId 
      },
      body: JSON.stringify(n8nPayload),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      console.error("N8N Error:", errText);
      return NextResponse.json({ message: "Error dari AI Server (n8n)" }, { status: 502 });
    }

    // 3. AMBIL RESPONSE & METADATA
    // n8n mengembalikan JSON: { answer, source, similarity, ... }
    const data = await res.json();

    return NextResponse.json({
      answer: data.answer || data.message || "Tidak ada jawaban.",
      // Metadata untuk UI (Debug/Info)
      meta: {
        source: data.source || "unknown", // 'cache' atau 'llm'
        similarity: data.similarity ? parseFloat(data.similarity).toFixed(4) : null
      }
    });

  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ message: "Gagal terhubung ke server." }, { status: 500 });
  }
}