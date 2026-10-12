# pi-copy

A Pi extension for copying output without terminal text selection.

## Install

```bash
pi install git:github.com/astrosheep-zero/pi-copy
```

Run `/reload` in an existing session after installation.

## Commands

- **`/cp`** — a two-pane picker in the **bottom input area** (same dock as Pi's
  built-in dialogs, via `ctx.ui.custom()` without overlay): a numbered short
  list on the left (full response, code blocks, sections, tables) and a live
  content preview on the right. Always opens, even for plain text — you
  confirm before anything is copied. `1-9` picks directly.
- **`/cp all`** — copy user and assistant text from the current conversation branch.

- **`/cp msg`** — pick any assistant response from the session (newest first),
  then drill into its blocks.
- **`Ctrl+Shift+C`** — same as `/cp`.

Selecting a table opens a **2D grid**: arrow through cells, `Enter` copies the
cell, `r` the row (TSV), `c` the column (with header), `a` the full Markdown
table, `Esc` goes back to the picker. Row/column/cell copies remove inline
Markdown formatting. Headings and horizontal rules delimit sections.
Escape cancels without changing the clipboard.

The original `/copy` command and its shortcuts are untouched. `Ctrl+Shift+C`
is the only shortcut registered.

Clipboard writes use Pi's own `copyToClipboard` API, including its platform
and remote-terminal support. Only interactive terminal mode is supported.
Copies exclude reasoning blocks, tool calls/results, and image data;
text in assistant messages is kept verbatim.

## Development

```bash
npm install
npm test
npm run typecheck
npm run check:load
```
