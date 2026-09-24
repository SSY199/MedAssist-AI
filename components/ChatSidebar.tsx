"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

export function ChatSidebar() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const router = useRouter();
  const params = useParams();
  const activeId = params?.conversationId as string | undefined;

  useEffect(() => {
    apiFetch("/chat/conversations").then(setConversations).catch(() => {});
  }, []);

  async function handleNew() {
    const convo = await apiFetch("/chat/conversations", {
      method: "POST",
      body: JSON.stringify({}),
    });
    setConversations((prev) => [convo, ...prev]);
    router.push(`/chat/${convo.id}`);
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await apiFetch(`/chat/conversations/${id}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) router.push("/chat");
  }

  return (
    <div className="flex w-64 shrink-0 flex-col border-r border-panel-border">
      <div className="p-3">
        <button
          onClick={handleNew}
          className="flex w-full items-center gap-2 rounded-lg border border-panel-border px-3 py-2 text-sm font-medium text-ink hover:bg-white/5"
        >
          <Plus size={15} /> New conversation
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2">
        {conversations.map((c) => (
          <Link
            key={c.id}
            href={`/chat/${c.id}`}
            className={`group mb-1 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
              activeId === c.id
                ? "bg-trace/10 text-trace"
                : "text-ink-muted hover:bg-white/5 hover:text-ink"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <MessageSquare size={14} className="shrink-0" />
              <span className="truncate">{c.title}</span>
            </span>
            <button
              onClick={(e) => handleDelete(c.id, e)}
              className="shrink-0 opacity-0 hover:text-alert group-hover:opacity-100"
              aria-label={`Delete ${c.title}`}
            >
              <Trash2 size={13} />
            </button>
          </Link>
        ))}
        {conversations.length === 0 && (
          <p className="px-3 py-2 text-xs text-ink-dim">No conversations yet.</p>
        )}
      </div>
    </div>
  );
}