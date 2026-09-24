/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Send, TriangleAlert, Bot } from "lucide-react";
import { apiFetch, apiFetchStream } from "@/lib/api-client";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  urgencyScore?: number | null;
}

export function ChatWindow({ conversationId }: { conversationId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [alertTriggered, setAlertTriggered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Loading history on conversation change IS "resume chat".
  useEffect(() => {
    setMessages([]);
    setAlertTriggered(false);
    setError(null);
    setLoadingHistory(true);

    apiFetch(`/chat/conversations/${conversationId}/messages`)
      .then((data: Message[]) => {
        setMessages(data);
        const last = data[data.length - 1];
        if (last && (last.urgencyScore ?? 0) >= 4) setAlertTriggered(true);
      })
      .catch(() => setError("Couldn't load this conversation."))
      .finally(() => setLoadingHistory(false));
  }, [conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  async function handleSend() {
    const text = input.trim();
    if (!text || alertTriggered || isStreaming) return;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: text }]);
    setInput("");
    setError(null);
    setIsStreaming(true);

    const assistantId = crypto.randomUUID();

    try {
      const stream = await apiFetchStream(`/chat/conversations/${conversationId}/message`, {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantStarted = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? ""; // last chunk may be incomplete

        for (const rawEvent of events) {
          const line = rawEvent.replace(/^data: /, "").trim();
          if (!line) continue;

          const event = JSON.parse(line);

          if (event.type === "chunk") {
            if (!assistantStarted) {
              assistantStarted = true;
              setMessages((prev) => [
                ...prev,
                { id: assistantId, role: "assistant", content: "" },
              ]);
            }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + event.text } : m
              )
            );
          } else if (event.type === "urgent") {
            setAlertTriggered(true);
          } else if (event.type === "error") {
            setError(event.message || "Something went wrong.");
          }
        }
      }
    } catch {
      setError("Couldn't reach the assistant. Try again in a moment.");
    } finally {
      setIsStreaming(false);
    }
  }

  if (loadingHistory) {
    return (
      <div className="flex h-[calc(100vh-57px)] items-center justify-center text-ink-muted">
        Loading conversation...
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-57px)] flex-1 flex-col">
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
              className={`max-w-[80%] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm ${
                m.role === "user"
                  ? "ml-auto border border-trace-dim bg-trace/10 text-ink"
                  : "border border-panel-border bg-panel text-ink"
              }`}
            >
              {m.content}
            </div>
          ))}

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
            disabled={alertTriggered || isStreaming}
            placeholder={alertTriggered ? "Chat paused" : "Describe what you're experiencing..."}
            className="flex-1 rounded-lg border border-panel-border bg-bg-deep px-4 py-2.5 text-sm text-ink placeholder:text-ink-dim focus:border-trace-dim focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={alertTriggered || isStreaming || !input.trim()}
            className="flex items-center justify-center rounded-lg bg-trace px-4 text-[#052914] transition hover:bg-[#65e89a] disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}