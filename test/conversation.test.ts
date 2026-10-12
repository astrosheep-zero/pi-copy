import assert from "node:assert/strict";
import { test } from "node:test";
import { collectConversation, conversationMarkdown, lastAssistantText } from "../src/conversation.ts";
import { entry } from "./fixtures.ts";

test("copies only visible user/assistant text, skipping reasoning, tools, images and metadata", () => {
  const messages = collectConversation([
    entry("user", [{ type: "text", text: "hello" }, { type: "image", data: "secret" }]),
    entry("assistant", [{ type: "thinking", thinking: "private" }, { type: "text", text: "one" }, { type: "text", text: "two" }]),
    entry("toolResult", [{ type: "text", text: "tool output" }]),
    entry("assistant", [{ type: "toolCall", name: "bash", arguments: {} }]),
    entry("custom", "not dialogue"),
    { type: "custom", customType: "metadata", data: {} } as unknown as import("@earendil-works/pi-coding-agent").SessionEntry,
  ]);
  assert.deepEqual(messages, [{ role: "user", text: "hello" }, { role: "assistant", text: "one\ntwo" }]);
  assert.equal(lastAssistantText(messages), "one\ntwo");
  assert.equal(conversationMarkdown(messages), "## User\n\nhello\n\n---\n\n## Assistant\n\none\ntwo");
  assert.equal(lastAssistantText(collectConversation([entry("user", "hi")])), undefined);
});
