import { MessageSquare } from "lucide-react";

export default function ChatIndexPage() {
  return (
    <div className="flex h-[calc(100vh-57px)] items-center justify-center text-center text-ink-muted">
      <div>
        <MessageSquare size={28} className="mx-auto mb-3 text-ink-dim" />
        <p className="text-sm">Select a conversation or start a new one.</p>
      </div>
    </div>
  );
}