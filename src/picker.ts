import type { TUI } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { matchesKey, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { CopyItem } from "./blocks.ts";
import { Dialog, type Hint } from "./dialog.ts";

export type PickerResult = { action: "copy"; item: CopyItem } | { action: "table"; item: CopyItem } | undefined;

const BODY_MAX = 14;
const LIST_WIDTH = 22;

function stripAnsi(line: string): string {
  return line.replace(/\x1b\[[0-9;]*m/g, "");
}

/** Two-pane copy picker: short list on the left, content preview on the right. */
export class CopyPicker extends Dialog<PickerResult> {
  private index = 0;
  private scroll = 0;
  private readonly items: readonly CopyItem[];

  constructor(tui: TUI, theme: Theme, title: string, items: readonly CopyItem[], done: (result: PickerResult) => void) {
    super(tui, theme, title, done);
    this.items = items;
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) {
      this.done(undefined);
      return;
    }
    if (matchesKey(data, "enter") || matchesKey(data, "return")) {
      const item = this.items[this.index];
      this.done(item?.table ? { action: "table", item } : item ? { action: "copy", item } : undefined);
      return;
    }
    if (/^[1-9]$/.test(data)) {
      const item = this.items[Number(data) - 1];
      if (item) {
        this.index = Number(data) - 1;
        this.done(item.table ? { action: "table", item } : { action: "copy", item });
      }
      return;
    }
    if (matchesKey(data, "up")) this.move(-1);
    else if (matchesKey(data, "down")) this.move(1);
    else if (matchesKey(data, "pageUp")) this.page(-1);
    else if (matchesKey(data, "pageDown")) this.page(1);
  }

  private move(delta: number): void {
    this.index = Math.min(this.items.length - 1, Math.max(0, this.index + delta));
    this.scroll = 0;
    this.refresh();
  }

  private page(delta: number): void {
    const max = Math.max(0, this.currentLines().length - BODY_MAX);
    this.scroll = Math.min(max, Math.max(0, this.scroll + delta * BODY_MAX));
    this.refresh();
  }

  private currentLines(): string[] {
    return (this.items[this.index]?.content ?? "").split("\n");
  }

  protected counter(): string {
    return `${this.index + 1}/${this.items.length}`;
  }

  protected body(width: number): string[] {
    const th = this.theme;
    const listW = Math.min(LIST_WIDTH, Math.max(14, width - 40));
    const previewW = Math.max(10, width - listW - 3);
    const badgeW = String(this.items.length).length;

    // Height fits content; long lists scroll inside a window around the cursor.
    const contentLines = this.currentLines();
    const bodyH = Math.max(1, Math.min(BODY_MAX, Math.max(this.items.length, contentLines.length)));
    const listStart = Math.min(Math.max(0, this.index - Math.floor(bodyH / 2)), Math.max(0, this.items.length - bodyH));
    const maxScroll = Math.max(0, contentLines.length - bodyH);
    this.scroll = Math.min(this.scroll, maxScroll);
    const visible = contentLines.slice(this.scroll, this.scroll + bodyH);

    const rows: string[] = [];
    for (let row = 0; row < bodyH; row++) {
      const itemIndex = listStart + row;
      let left = "";
      if (itemIndex < this.items.length) {
        const item = this.items[itemIndex];
        const selected = itemIndex === this.index;
        const badge = th.fg(selected ? "accent" : "dim", String(itemIndex + 1).padStart(badgeW));
        const name = truncateToWidth(item.title + (item.table ? " ▸" : ""), listW - 5, "…");
        left = selected
          ? `${th.fg("accent", "❯")} ${badge}${th.fg("dim", ".")} ${th.bold(th.fg("accent", name))}`
          : `  ${badge}${th.fg("dim", ".")} ${name}`;
      }
      const leftPad = " ".repeat(Math.max(0, listW - visibleWidth(left)));
      const right = row < visible.length ? truncateToWidth(stripAnsi(visible[row]), previewW, "…") : "";
      rows.push(`${left}${leftPad}${th.fg("dim", " │ ")}${th.fg("text", right)}`);
    }
    return rows;
  }

  protected hints(): readonly Hint[] {
    return [["1-9", "pick"], ["↑↓", "move"], ["pgup/pgdn", "preview"], ["enter", "copy"], ["esc", "cancel"]];
  }
}
