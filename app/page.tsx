"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { uuid } from "./lib/uuid";

type Message = { role: "user" | "assistant"; content: string };

const PRODUCT_OPTIONS = [
  { code: "AWS-S3", label: "AWS – Amazon S3 (Storage)" },
  { code: "AWS-EC2", label: "AWS – Amazon EC2 (Compute)" },
  { code: "GCP-CS", label: "GCP – Cloud Storage (Storage)" },
  { code: "GCP-CE", label: "GCP – Compute Engine (Compute)" },
  { code: "HUAWEI-OBS", label: "Huawei Cloud – OBS (Storage)" },
  { code: "HUAWEI-ECS", label: "Huawei Cloud – ECS (Compute)" }
];

export default function HomePage() {
  const [sessionId] = useState(uuid);
  const [productCode, setProductCode] = useState(PRODUCT_OPTIONS[0].code);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const placeholder = useMemo(
    () => "Tanya apa saja tentang produk ini (contoh: \"Ini produk apa ya? cocok untuk apa?\")",
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
        body: JSON.stringify({ sessionId, message: text, productCode })
      });

      if (!res.ok) {
        const t = await res.text();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Maaf, terjadi kesalahan di server FE.\n" + t }
        ]);
      } else {
        const data = await res.json();
        const answer: string = data?.answer ?? data?.message ?? "(tidak ada jawaban)";
        setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
      }
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
    if (e.key === "Enter") sendMessage();
  }

  return (
    <div className="container">
      <div className="card">
        <div className="header">
          <div>
            <div className="title">AI Product Assistant</div>
            <div className="badge">Demo Chatbot — Cache Augmented Generation</div>
          </div>
          <div className="row">
            <span className="badge">Product Code:</span>
            <select
              className="select"
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              disabled={loading}
            >
              {PRODUCT_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div ref={chatRef} className="chat card" style={{ height: "58vh" }}>
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role === "user" ? "me" : "bot"}`}>
              {m.content}
            </div>
          ))}
          {messages.length === 0 && (
            <div className="badge">Mulai dengan memilih produk, lalu ajukan pertanyaan…</div>
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
