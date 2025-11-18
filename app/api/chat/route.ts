import { NextRequest, NextResponse } from "next/server";

// --- CONFIGURATION ---
const TIMEOUT_MS = 300_000; // 5 Menit (Aman untuk CPU Inference)

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-request-id",
};

// --- TYPES ---
interface ChatRequestBody {
  sessionId: string;
  message: string;
}

interface N8nResponse {
  answer?: string;
  message?: string;
  data?: { answer?: string }; // Jaga-jaga struktur bersarang
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

// --- HELPER: Normalisasi Respon dari n8n ---
// n8n kadang mengembalikan JSON yang strukturnya berubah-ubah tergantung node terakhir.
function normalizeResponse(data: N8nResponse | string): { answer: string; meta?: any } {
  if (typeof data === "string") {
    return { answer: data };
  }

  // Cari jawaban di berbagai kemungkinan field
  const answer =
    data.answer ??
    data.message ??
    data.data?.answer ??
    "Tidak ada jawaban teks dari sistem.";

  return {
    answer: String(answer),
    meta: data.meta,
  };
}

// --- HANDLER: OPTIONS (CORS Preflight) ---
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// --- HANDLER: POST (Main Logic) ---
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  // 1. Validasi Content-Type
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { message: "Invalid Content-Type. Must be application/json" },
      { status: 415, headers: CORS_HEADERS }
    );
  }

  // 2. Validasi Body
  let body: ChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const { sessionId, message } = body;
  if (!sessionId || !message) {
    return NextResponse.json(
      { message: "Missing required fields: sessionId, message" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // 3. Cek Environment Variable
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("❌ SERVER ERROR: N8N_WEBHOOK_URL missing in .env");
    return NextResponse.json(
      { message: "Server misconfiguration (Missing Webhook URL)" },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  // 4. Persiapan Fetch dengan Timeout (AbortController)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // --- REQUEST KE N8N ---
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify({ sessionId, message }),
      signal: controller.signal,
    });

    // Parse Response (Text dulu, baru coba JSON)
    const rawText = await res.text();
    let jsonResponse: N8nResponse | string;
    
    try {
      jsonResponse = JSON.parse(rawText);
    } catch {
      // Kalau n8n return error HTML/Plain text, kita tangkap di sini
      jsonResponse = rawText;
    }

    // Handle Error HTTP dari n8n (misal 404, 500)
    if (!res.ok) {
      console.error(`❌ N8N Error [${res.status}]:`, rawText);
      return NextResponse.json(
        {
          message: "Terjadi kesalahan pada proses AI (Upstream Error)",
          detail: jsonResponse,
          requestId,
        },
        { status: 502, headers: CORS_HEADERS } // 502 Bad Gateway
      );
    }

    // 5. Sukses - Format Data untuk Frontend
    const sanitizedData = normalizeResponse(jsonResponse);

    return NextResponse.json(
      {
        answer: sanitizedData.answer,
        meta: sanitizedData.meta,
        requestId,
      },
      { status: 200, headers: CORS_HEADERS }
    );

  } catch (error: unknown) {
    const err = error as Error;
    
    // 6. Handle Spesifik: Timeout vs Network Error
    if (err.name === "AbortError") {
      console.error(`⏱️ TIMEOUT: Request took longer than ${TIMEOUT_MS}ms`);
      return NextResponse.json(
        { message: "AI membutuhkan waktu terlalu lama untuk menjawab (Timeout). Coba lagi nanti." },
        { status: 504, headers: CORS_HEADERS } // 504 Gateway Timeout
      );
    }

    console.error("❌ NETWORK ERROR:", err.message);
    return NextResponse.json(
      {
        message: "Gagal menghubungi server AI.",
        error: err.message,
        requestId,
      },
      { status: 500, headers: CORS_HEADERS }
    );

  } finally {
    // Pastikan timer dimatikan agar tidak memory leak
    clearTimeout(timeoutId);
  }
}