import assert from "node:assert/strict";
import { test } from "node:test";
import extension from "../src/index.ts";

test("registers /cp with completions and the ctrl+shift+c shortcut", () => {
  const commands = new Map<string, { getArgumentCompletions?: (prefix: string) => unknown }>();
  const shortcuts: string[] = [];
  extension({
    registerCommand: (name: string, command: { getArgumentCompletions?: (prefix: string) => unknown }) => commands.set(name, command),
    registerShortcut: (key: string) => shortcuts.push(key),
  } as unknown as Parameters<typeof extension>[0]);

  assert.deepEqual([...commands.keys()], ["cp"]);
  assert.deepEqual(shortcuts, ["ctrl+shift+c"]);
  const completions = commands.get("cp")?.getArgumentCompletions?.("") as { value: string }[];
  assert.deepEqual(completions.map((c) => c.value), ["all", "msg"]);
});
