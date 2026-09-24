import { ChatWindow } from "@/components/ChatWindow";

export default async function ChatConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  return <ChatWindow conversationId={conversationId} />;
}