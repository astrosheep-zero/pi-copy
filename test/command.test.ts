import assert from "node:assert/strict";
import { test } from "node:test";
import type { ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";
import { createCopyHandler } from "../src/command.ts";
import { DOWN, ENTER, ESC, RIGHT, entry, fakeTheme, fakeTui, tick } from "./fixtures.ts";

type Keyable = { handleInput?: (data: string) => void };

function fixture(entries: SessionEntry[], picks: (string | undefined)[] = [], mode = "tui") {
  const notices: { message: string; type: string }[] = [];
  const menus: string[][] = [];
  const writes: string[] = [];
  const components: Keyable[] = [];
  let active: Keyable | undefined;
  const ctx = {
    mode,
    sessionManager: { getBranch: () => entries },
    ui: {
      notify: (message: string, type: string) => notices.push({ message, type }),
      select: async (_title: string, options: string[]) => {
        menus.push(options);
        const pick = picks.shift();
        return pick === undefined ? undefined : options.find((option) => option.startsWith(pick));
      },
      custom: async (factory: (tui: typeof fakeTui, theme: typeof fakeTheme, kb: unknown, done: (result: unknown) => void) => Keyable) =>
        new Promise((resolve) => {
          const component = factory(fakeTui, fakeTheme, undefined, (result) => {
            active = undefined;
            resolve(result);
          });
          components.push(component);
          active = component;
        }),
    },
  } as unknown as ExtensionContext;
  const handler = createCopyHandler(async (text) => { writes.push(text); });
  const key = (data: string) => active?.handleInput?.(data);
  return { ctx, handler, notices, menus, writes, key, components, pickerActive: () => active !== undefined };
}

test("/cp opens the picker even for plain replies", async () => {
  const f = fixture([entry("assistant", [{ type: "text", text: "Hello\n世界" }])]);
  const pending = f.handler("", f.ctx);
  assert.equal(f.pickerActive(), true);
  f.key(ENTER); // first item: Full response
  await pending;
  assert.deepEqual(f.writes, ["Hello\n世界"]);
  assert.equal(f.pickerActive(), false);
});

test("Escape in the picker leaves the clipboard untouched", async () => {
  const f = fixture([entry("assistant", [{ type: "text", text: "Hello" }])]);
  const pending = f.handler("", f.ctx);
  f.key(ESC);
  await pending;
  assert.deepEqual(f.writes, []);
  assert.deepEqual(f.notices, []);
  assert.equal(f.pickerActive(), false);
});

test("/cp copies a code block selected with arrow keys", async () => {
  const f = fixture([entry("assistant", [{ type: "text", text: "# A\n\nUse:\n\n```sh\necho hi\n```" }])]);
  const pending = f.handler("", f.ctx);
  f.key(DOWN); // Full response → Code 1 · sh
  f.key(ENTER);
  await pending;
  assert.deepEqual(f.writes, ["echo hi"]);
});

test("/cp number keys pick directly", async () => {
  const f = fixture([entry("assistant", [{ type: "text", text: "# A\n\nUse:\n\n```sh\necho hi\n```" }])]);
  const pending = f.handler("", f.ctx);
  f.key("2"); // Code 1 · sh
  await pending;
  assert.deepEqual(f.writes, ["echo hi"]);
});

test("/cp table opens a 2D grid and copies a cell", async () => {
  const markdown = "| Name | Value |\n| --- | --- |\n| **Faye** | x |\n";
  const f = fixture([entry("assistant", [{ type: "text", text: markdown }])]);
  const pending = f.handler("", f.ctx);
  f.key(DOWN); // Full response → Table 1
  f.key(ENTER); // opens grid
  await tick();
  f.key(DOWN); // header → row 1
  f.key(RIGHT); // col 1 → col 2
  f.key(ENTER); // copy cell
  await pending;
  assert.deepEqual(f.writes, ["x"]);
  assert.equal(f.components.length, 2); // picker + grid
});

test("table grid copies rows, columns, and the full table", async () => {
  const markdown = "| Name | Value |\n| --- | --- |\n| Faye | x |\n| Oreo | y |\n";
  for (const [keys, expected] of [
    [["r"], "Faye\tx"],
    [["c"], "Name\nFaye\nOreo"],
    [["a"], markdown],
  ] as const) {
    const f = fixture([entry("assistant", [{ type: "text", text: markdown }])]);
    const pending = f.handler("", f.ctx);
    f.key(DOWN);
    f.key(ENTER); // grid, cursor on header
    await tick();
    f.key(DOWN); // row 1
    for (const k of keys) f.key(k);
    await pending;
    assert.deepEqual(f.writes, [expected]);
  }
});

test("esc in the grid goes back to the picker", async () => {
  const markdown = "| A |\n| --- |\n| x |";
  const f = fixture([entry("assistant", [{ type: "text", text: markdown }])]);
  const pending = f.handler("", f.ctx);
  f.key(DOWN);
  f.key(ENTER); // grid
  await tick();
  f.key(ESC); // back to picker
  await tick();
  assert.equal(f.pickerActive(), true);
  f.key(ESC); // cancel picker
  await pending;
  assert.deepEqual(f.writes, []);
  assert.equal(f.components.length, 3); // picker + grid + picker
});

test("/cp msg picks an older response then a block inside it", async () => {
  const f = fixture([
    entry("assistant", [{ type: "text", text: "first answer" }]),
    entry("assistant", [{ type: "text", text: "second answer\n\n```sh\necho two\n```" }]),
  ]);
  const pending = f.handler("msg", f.ctx);
  f.key(DOWN); // newest first: Response 2 → Response 1
  f.key(ENTER); // choose Response 1 → block picker
  await tick();
  f.key(ENTER); // Full response
  await pending;
  assert.deepEqual(f.writes, ["first answer"]);
});

test("/cp all uses current branch user/assistant text", async () => {
  const f = fixture([entry("user", "Hi"), entry("assistant", [{ type: "text", text: "Hello" }])]);
  await f.handler(" all ", f.ctx);
  assert.deepEqual(f.writes, ["## User\n\nHi\n\n---\n\n## Assistant\n\nHello"]);
  assert.equal(f.pickerActive(), false);
});

test("unsupported modes, invalid args, and missing output warn without copying", async () => {
  for (const [args, mode] of [["", "rpc"], ["bogus", "tui"], ["", "tui"], ["all", "tui"], ["msg", "tui"]]) {
    const f = fixture([], [], mode);
    await f.handler(args, f.ctx);
    assert.deepEqual(f.writes, []);
    assert.equal(f.notices.length, 1);
    assert.notEqual(f.notices[0].type, "info");
  }
});

test("clipboard errors are reported without a success notification", async () => {
  const f = fixture([entry("assistant", [{ type: "text", text: "Hello" }])]);
  const failing = createCopyHandler(async () => { throw new Error("Clipboard unavailable"); });
  const pending = failing("", f.ctx);
  f.key(ENTER);
  await pending;
  assert.deepEqual(f.notices, [{ message: "Copy failed: Clipboard unavailable", type: "error" }]);
});
