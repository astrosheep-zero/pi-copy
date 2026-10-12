import type { SessionEntry, Theme } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";

export const DOWN = "\x1b[B";
export const UP = "\x1b[A";
export const RIGHT = "\x1b[C";
export const ENTER = "\r";
export const ESC = "\x1b";

/** Flush microtasks so the next dialog (grid/picker) exists before sending keys. */
export const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

export const fakeTui = { requestRender: () => {} } as unknown as TUI;

export const fakeTheme = {
  fg: (_color: string, text: string) => text,
  bg: (_color: string, text: string) => text,
  bold: (text: string) => text,
} as unknown as Theme;

export function entry(role: string, content: unknown): SessionEntry {
  return {
    type: "message", id: "test", parentId: null, timestamp: "2026-10-04T00:00:00Z",
    message: { role, content },
  } as unknown as SessionEntry;
}
