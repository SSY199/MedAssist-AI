"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Send, TriangleAlert, Bot } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [alertTriggered, setAlertTriggered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  async function handleSend() {
    const text = input.trim();
    if (!text || alertTriggered || isTyping) return;

    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError(null);
    setIsTyping(true);

    try {
      const data: { reply: string; urgencyScore: number } = await apiFetch("/chat/message", {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });

      if (data.urgencyScore >= 4) {
        setAlertTriggered(true);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: data.reply },
        ]);
      }
    } catch {
      setError("Couldn't reach the assistant. Try again in a moment.");
    } finally {
      setIsTyping(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <div className="border-b border-panel-border bg-bg-deep px-6 py-2.5 text-center font-mono text-[11px] text-ink-dim">
        Informational only — not a diagnosis. In an emergency, seek immediate care.
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 && !alertTriggered && (
          <div className="flex h-full items-center justify-center text-center text-ink-muted">
            <div>
              <Bot size={28} className="mx-auto mb-3 text-ink-dim" />
              <p className="text-sm">Ask about a symptom, condition, or your recent labs.</p>
            </div>
          </div>
        )}

        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                m.role === "user"
                  ? "ml-auto border border-trace-dim bg-trace/10 text-ink"
                  : "border border-panel-border bg-panel text-ink"
              }`}
            >
              {m.content}
            </div>
          ))}

          {isTyping && (
            <div className="max-w-[80%] rounded-xl border border-panel-border bg-panel px-4 py-3 text-sm text-ink-dim">
              Thinking...
            </div>
          )}

          {error && (
            <div className="max-w-[80%] rounded-xl border border-alert/40 bg-alert-dim px-4 py-3 text-sm text-alert">
              {error}
            </div>
          )}

          {alertTriggered && (
            <div className="flex items-start gap-4 rounded-xl border border-alert/45 bg-alert-dim p-5">
              <TriangleAlert className="mt-0.5 shrink-0 text-alert" size={24} />
              <div>
                <h3 className="mb-1 font-display text-sm font-bold text-alert">
                  This sounds urgent
                </h3>
                <p className="mb-3 text-sm text-ink-muted">
                  What you described may need immediate medical attention.
                  Chat is paused — please get care now rather than continuing
                  to type here.
                </p>
                <Link
                  href="/map"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-alert px-4 py-2 text-xs font-bold text-[#3a0a0a]"
                >
                  Find the nearest ER
                </Link>
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </div>

      <div className="border-t border-panel-border p-4">
        <div className="mx-auto flex max-w-2xl gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={alertTriggered || isTyping}
            placeholder={alertTriggered ? "Chat paused" : "Describe what you're experiencing..."}
            className="flex-1 rounded-lg border border-panel-border bg-bg-deep px-4 py-2.5 text-sm text-ink placeholder:text-ink-dim focus:border-trace-dim focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={alertTriggered || isTyping || !input.trim()}
            className="flex items-center justify-center rounded-lg bg-trace px-4 text-[#052914] transition hover:bg-[#65e89a] disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}