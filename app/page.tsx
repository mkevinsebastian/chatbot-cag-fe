"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { uuid } from "./lib/uuid";

type Message = { role: "user" | "assistant"; content: string };
type ApiResp =
  | { answer: string; meta?: { product?: string; provider?: string; cacheHit?: boolean; similarity?: number } }
  | { message: string; detail?: unknown };

export default function HomePage() {
  const [sessionId] = useState(uuid);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [meta, setMeta] = useState<{ product?: string; provider?: string; cacheHit?: boolean; similarity?: number } | null>(null);

  const chatRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const placeholder = useMemo(
    () => 'Tanya apa saja tentang produk cloud (contoh: "Apa itu GCP?", "Huawei Cloud itu apa?")',
    []
  );

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: text }) // ⬅ tanpa productCode
      });

      const raw = await res.text();
      let data: ApiResp | null;
      try {
        data = JSON.parse(raw);
      } catch {
        data = { answer: raw as unknown as string };
      }

      if (!res.ok) {
        const msg =
          (data as any)?.message ||
          "Maaf, terjadi kesalahan di server (n8n/FE). Coba lagi sebentar ya.";
        setMessages((prev) => [...prev, { role: "assistant", content: msg }]);
        setLoading(false);
        return;
      }

      const answer =
        (data as any)?.answer ??
        (data as any)?.message ??
        "Tidak ada jawaban dari n8n.";

      setMessages((prev) => [...prev, { role: "assistant", content: String(answer) }]);
      setMeta((data as any)?.meta ?? null);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Gagal menghubungi server: " + (err?.message ?? err) }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="container">
      <div className="card">
        <div className="header">
          <div>
            <div className="title">AI Product Assistant</div>
            <div className="badge">Demo Chatbot — Cache Augmented Generation</div>
          </div>
          {meta && (meta.product || meta.provider) && (
            <div className="row">
              <span className="badge">
                {meta.provider ? `${meta.provider}` : ""}
                {meta.product ? ` – ${meta.product}` : ""}
                {meta.cacheHit ? " (cache)" : ""}
              </span>
            </div>
          )}
        </div>

        <div ref={chatRef} className="chat card" style={{ height: "58vh" }}>
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role === "user" ? "me" : "bot"}`}>
              {m.content}
            </div>
          ))}
          {messages.length === 0 && (
            <div className="badge">
              Mulai tanya: &quot;Apa itu GCP?&quot;, &quot;Huawei Cloud itu apa?&quot;, atau
              &quot;Bedanya object storage vs block storage?&quot;
            </div>
          )}
          {loading && <div className="msg bot">Sedang menyusun jawaban…</div>}
        </div>

        <div className="footer">
          <input
            className="input"
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={loading}
            autoFocus
            style={{ flex: 1 }}
          />
          <button className="button" onClick={sendMessage} disabled={loading}>
            {loading ? "Mengirim…" : "Kirim"}
          </button>
        </div>
      </div>
    </div>
  );
}
