import type { SessionEntry } from "@earendil-works/pi-coding-agent";

export interface ConversationMessage {
  role: "user" | "assistant";
  text: string;
}

// Only visible text on the active branch: no reasoning, tool calls/results,
// custom messages, or image bytes.
export function collectConversation(entries: readonly SessionEntry[]): ConversationMessage[] {
  const messages: ConversationMessage[] = [];
  for (const entry of entries) {
    if (entry.type !== "message") continue;
    const { message } = entry;
    if (message.role !== "user" && message.role !== "assistant") continue;
    const text = typeof message.content === "string"
      ? message.content
      : message.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
    if (text.trim()) messages.push({ role: message.role, text });
  }
  return messages;
}

export function lastAssistantText(messages: readonly ConversationMessage[]): string | undefined {
  return messages.findLast((message) => message.role === "assistant")?.text;
}

export function conversationMarkdown(messages: readonly ConversationMessage[]): string {
  return messages.map(({ role, text }) => `## ${role === "user" ? "User" : "Assistant"}\n\n${text}`).join("\n\n---\n\n");
}
