import type { ChatMessage } from "./types";

/** Client-local "08:25 AM"-style time. */
export function formatChatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Re-stamp server-loaded messages with the viewer's local timezone. The
 * history API pre-formats `timestamp` on the server (UTC on Vercel), so
 * without this, reloaded chats show UTC times instead of local times.
 */
export function withLocalTimestamps(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => {
    if (!message.createdAt) return message;
    const at = new Date(message.createdAt);
    if (Number.isNaN(at.getTime())) return message;
    return { ...message, timestamp: formatChatTime(at) };
  });
}
