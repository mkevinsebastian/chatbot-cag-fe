"use client";

import { useEffect, useRef, useState } from "react";
// Jika file uuid.ts belum ada, gunakan fungsi dummy di bawah ini:
const generateSessionId = () => Math.random().toString(36).substring(2, 15);

type Message = { 
  role: "user" | "assistant"; 
  content: string;
  meta?: { source?: string; similarity?: number | null }
};

export default function HomePage() {
  const [sessionId] = useState(generateSessionId);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const chatRef = useRef<HTMLDivElement>(null);

  // Auto-scroll ke bawah saat chat bertambah
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    // 1. Tampilkan pesan user
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      // 2. Kirim ke API Route
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sessionId, 
          message: text,
          productCode: "PROD-001" // Opsional: Hapus jika ingin mencari semua produk
        })
      });

      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message || "Gagal menghubungi server");

      // 3. Tampilkan balasan bot
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: data.answer,
        meta: {
          source: data.meta?.source,
          similarity: data.meta?.similarity ? parseFloat(data.meta.similarity) : null
        }
      }]);

    } catch (err: any) {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Maaf, terjadi kesalahan: " + err.message }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="main-container">
      <div className="chat-card">
        
        {/* HEADER */}
        <div className="chat-header">
          <h1>🤖 AI Support Center</h1>
          <p>Tanya Jawab Produk & Layanan</p>
        </div>

        {/* CHAT AREA */}
        <div className="chat-body" ref={chatRef}>
          {messages.length === 0 && (
            <div style={{textAlign: "center", color: "#888", marginTop: "50px"}}>
              <p>Halo! Silakan tanya tentang produk kami.</p>
              <small>Contoh: "Apa kelebihan Neo VPS?"</small>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`message-row ${m.role}`}>
              <div className="bubble">
                {m.content}
                
                {/* Tampilkan Info Source (Hanya untuk Bot) */}
                {m.role === "assistant" && m.meta?.source && (
                  <div className="meta-info">
                    <span className={`badge ${m.meta.source}`}>
                      {m.meta.source.toUpperCase()}
                    </span>
                    {m.meta.source === 'cache' && m.meta.similarity && (
                      <span style={{marginLeft: "5px", color: "#666"}}>
                        (Akurasi: {m.meta.similarity.toFixed(4)})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="message-row assistant">
              <div className="bubble" style={{color: "#888"}}>
                <em>Sedang mengetik...</em>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER INPUT */}
        <div className="chat-footer">
          <input
            className="chat-input"
            placeholder="Ketik pesan Anda..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            disabled={loading}
            autoFocus
          />
          <button className="send-btn" onClick={sendMessage} disabled={loading || !input}>
            ➤
          </button>
        </div>

      </div>
    </div>
  );
}