import { ChatSidebar } from "@/components/ChatSidebar";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex">
      <ChatSidebar />
      <div className="flex-1">{children}</div>
    </div>
  );
}