import type { TUI } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { matchesKey, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { CopyItem } from "./blocks.ts";
import { Dialog, type Hint } from "./dialog.ts";

export interface GridCopy {
  label: string;
  content: string;
}
export type GridResult = GridCopy | undefined;

const MAX_VISIBLE_ROWS = 12;
const MAX_COL_WIDTH = 24;

function padVisible(text: string, width: number): string {
  const truncated = truncateToWidth(text, width, "…");
  return truncated + " ".repeat(Math.max(0, width - visibleWidth(truncated)));
}

function gridTitle(item: CopyItem): string {
  const table = item.table;
  return `${item.title} · ${table?.rows.length ?? 0} rows × ${table?.headers.length ?? 0} cols`;
}

/** 2D table grid: arrow through cells, enter/r/c/a to copy, esc to go back. */
export class TableGrid extends Dialog<GridResult> {
  private row = 0; // 0 = header
  private col = 0;
  private readonly item: CopyItem;

  constructor(tui: TUI, theme: Theme, item: CopyItem, done: (result: GridResult) => void) {
    super(tui, theme, gridTitle(item), done);
    this.item = item;
  }

  private matrix(): string[][] {
    const table = this.item.table;
    return table ? [table.headers, ...table.rows] : [];
  }

  private rowLabel(): string {
    return this.row === 0 ? "Header" : `Row ${this.row}`;
  }

  private cellContent(): GridCopy {
    return {
      label: `${this.rowLabel()}, col ${this.col + 1}`,
      content: this.matrix()[this.row]?.[this.col] ?? "",
    };
  }

  private rowContent(): GridCopy {
    return {
      label: `${this.rowLabel()} · TSV`,
      content: (this.matrix()[this.row] ?? []).join("\t"),
    };
  }

  private columnContent(): GridCopy {
    return {
      label: `Column ${this.col + 1} (including header)`,
      content: this.matrix().map((row) => row[this.col] ?? "").join("\n"),
    };
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) {
      this.done(undefined);
      return;
    }
    if (matchesKey(data, "enter") || matchesKey(data, "return")) {
      this.done(this.cellContent());
      return;
    }
    if (data === "r") {
      this.done(this.rowContent());
      return;
    }
    if (data === "c") {
      this.done(this.columnContent());
      return;
    }
    if (data === "a") {
      this.done({ label: `${this.item.title} · Markdown`, content: this.item.content });
      return;
    }
    const matrix = this.matrix();
    if (matchesKey(data, "up")) this.row = Math.max(0, this.row - 1);
    else if (matchesKey(data, "down")) this.row = Math.min(matrix.length - 1, this.row + 1);
    else if (matchesKey(data, "left")) this.col = Math.max(0, this.col - 1);
    else if (matchesKey(data, "right")) this.col = Math.min((matrix[0]?.length ?? 1) - 1, this.col + 1);
    else return;
    this.refresh();
  }

  protected counter(): string {
    return `${this.rowLabel()}, col ${this.col + 1}`;
  }

  protected body(width: number): string[] {
    const th = this.theme;
    const matrix = this.matrix();
    const headers = matrix[0] ?? [];

    const colWidths = headers.map((header, ci) => {
      let max = visibleWidth(header);
      for (const row of matrix.slice(1)) max = Math.max(max, visibleWidth(row[ci] ?? ""));
      return Math.min(Math.max(max, 3), MAX_COL_WIDTH);
    });

    const renderRow = (cells: string[], rowIndex: number): string => {
      const parts = cells.map((cell, ci) => {
        const padded = padVisible(cell, colWidths[ci] ?? 3);
        const selected = rowIndex === this.row && ci === this.col;
        if (selected) return th.bg("selectedBg", th.fg("accent", padded));
        return rowIndex === 0 ? th.bold(th.fg("text", padded)) : th.fg("text", padded);
      });
      return `  ${parts.join(th.fg("dim", " │ "))}`;
    };

    const rows: string[] = [
      truncateToWidth(renderRow(headers, 0), width, "…"),
      th.fg("dim", `  ${colWidths.map((cw) => "─".repeat(cw)).join("─┼─")}`),
    ];

    const start = Math.min(Math.max(0, this.row - Math.floor(MAX_VISIBLE_ROWS / 2)), Math.max(0, matrix.length - 1 - MAX_VISIBLE_ROWS));
    const end = Math.min(matrix.length, start + 1 + MAX_VISIBLE_ROWS);
    for (let ri = Math.max(1, start); ri < end; ri++) {
      rows.push(truncateToWidth(renderRow(matrix[ri] ?? [], ri), width, "…"));
    }
    if (matrix.length - 1 > MAX_VISIBLE_ROWS) {
      rows.push(th.fg("dim", `  rows ${Math.max(1, start)}–${end - 1} of ${matrix.length - 1}`));
    }

    const cell = matrix[this.row]?.[this.col] ?? "";
    rows.push("");
    rows.push(th.fg("dim", "cell · ") + th.fg("text", truncateToWidth(cell || "(empty)", Math.max(10, width - 10), "…")));
    return rows;
  }

  protected hints(): readonly Hint[] {
    return [["↑↓←→", "move"], ["enter", "cell"], ["r", "row"], ["c", "column"], ["a", "all"], ["esc", "back"]];
  }
}
