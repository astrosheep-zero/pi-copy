import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { copyItems, type CopyItem } from "./blocks.ts";
import { collectConversation, conversationMarkdown, lastAssistantText } from "./conversation.ts";
import { CopyPicker, type PickerResult } from "./picker.ts";
import { TableGrid, type GridResult } from "./table-grid.ts";
import type { Dialog } from "./dialog.ts";
import type { Theme } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";

/** Show a dialog docked in the bottom input area (no overlay). */
function showDialog<T>(ctx: ExtensionContext, create: (tui: TUI, theme: Theme, done: (result: T) => void) => Dialog<T>): Promise<T> {
  return ctx.ui.custom<T>((tui, theme, _kb, done) => create(tui, theme, done));
}

async function rawPick(ctx: ExtensionContext, title: string, items: readonly CopyItem[]): Promise<PickerResult> {
  return showDialog(ctx, (tui, theme, done) => new CopyPicker(tui, theme, title, items, done));
}

async function pickItem(ctx: ExtensionContext, title: string, items: readonly CopyItem[]): Promise<CopyItem | undefined> {
  while (true) {
    const result = await rawPick(ctx, title, items);
    if (result?.action === "table") {
      const grid = await showDialog<GridResult>(ctx, (tui, theme, done) => new TableGrid(tui, theme, result.item, done));
      if (grid === undefined) continue; // esc in the grid goes back to the picker
      return { kind: "table", title: grid.label, content: grid.content };
    }
    if (result?.action === "copy") return result.item;
    return undefined;
  }
}

const USAGE = "Usage: /cp, /cp all, or /cp msg";

export function createCopyHandler(copy: (text: string) => Promise<void>) {
  return async (args: string, ctx: ExtensionContext): Promise<void> => {
    if (ctx.mode !== "tui") {
      ctx.ui.notify("/cp requires interactive terminal mode", "error");
      return;
    }
    const action = args.trim();
    if (action !== "" && action !== "all" && action !== "msg") {
      ctx.ui.notify(USAGE, "warning");
      return;
    }

    try {
      const messages = collectConversation(ctx.sessionManager.getBranch());
      let item: CopyItem | undefined;
      if (action === "all") {
        const content = conversationMarkdown(messages);
        if (!content) {
          ctx.ui.notify("No conversation to copy", "warning");
          return;
        }
        item = { kind: "full", title: "Conversation", content };
      } else if (action === "msg") {
        const responses = messages.filter((message) => message.role === "assistant");
        if (responses.length === 0) {
          ctx.ui.notify("No assistant response to copy", "warning");
          return;
        }
        // Newest first; titles keep the chronological response number.
        const responseItems = responses
          .map((message, i): CopyItem => ({ kind: "full", title: `Response ${i + 1}`, content: message.text }))
          .reverse();
        const chosen = await rawPick(ctx, "Pick a response", responseItems);
        if (chosen?.action !== "copy") return;
        item = await pickItem(ctx, chosen.item.title, copyItems(chosen.item.content));
      } else {
        const text = lastAssistantText(messages);
        if (text === undefined) {
          ctx.ui.notify("No assistant response to copy", "warning");
          return;
        }
        item = await pickItem(ctx, "Copy assistant output", copyItems(text));
      }
      if (!item) return; // Escape never writes to the clipboard.
      await copy(item.content);
      ctx.ui.notify(`Copied: ${item.title}`, "info");
    } catch (error) {
      ctx.ui.notify(`Copy failed: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  };
}
