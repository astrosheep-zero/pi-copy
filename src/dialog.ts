import type { Component, TUI } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";

export type Hint = [key: string, label: string];

export function joinHints(theme: Theme, hints: readonly Hint[]): string {
  return hints
    .map(([key, label]) => theme.fg("accent", key) + theme.fg("dim", " " + label))
    .join(theme.fg("dim", "  ·  "));
}

/**
 * Shared dialog chrome for ctx.ui.custom() WITHOUT overlay — the component
 * docks in the bottom input area, like pi's built-in dialogs:
 * accent top rule with title and right-aligned counter, subclass body rows,
 * hint footer, accent bottom rule.
 */
export abstract class Dialog<T> implements Component {
  private cached: string[] | undefined;
  protected readonly tui: TUI;
  protected readonly theme: Theme;
  protected readonly title: string;
  private readonly doneCallback: (result: T) => void;

  constructor(tui: TUI, theme: Theme, title: string, done: (result: T) => void) {
    this.tui = tui;
    this.theme = theme;
    this.title = title;
    this.doneCallback = done;
  }

  protected done(result: T): void {
    this.doneCallback(result);
  }

  protected refresh(): void {
    this.cached = undefined;
    this.tui.requestRender();
  }

  invalidate(): void {
    this.cached = undefined;
  }

  dispose(): void {}

  abstract handleInput(data: string): void;
  protected abstract counter(): string;
  protected abstract body(width: number): string[];
  protected abstract hints(): readonly Hint[];

  render(width: number): string[] {
    if (this.cached) return this.cached;
    const th = this.theme;
    const w = Math.max(20, width);
    const accent = (s: string) => th.fg("accent", s);

    const titleText = ` ${this.title} `;
    const counterText = ` ${this.counter()} `;
    const fill = Math.max(0, w - 2 - visibleWidth(titleText) - visibleWidth(counterText));
    const top = accent("─") + th.bold(accent(titleText)) + accent("─".repeat(fill)) + th.fg("dim", counterText) + accent("─");

    this.cached = [top, "", ...this.body(w), joinHints(th, this.hints()), accent("─".repeat(w))];
    return this.cached;
  }
}
