import assert from "node:assert/strict";
import { test } from "node:test";
import { copyItems, preview, tableCells, tableColumns, tableRows } from "../src/blocks.ts";

test("keeps full Markdown verbatim, extracts fenced code, and ignores headings inside fences", () => {
  const markdown = "# First\n\nHello\n\n````md\n# Not a section\n```js\nconst x = 1\n```\n````\n\n---\n\n## Second\n\nWorld\n";
  const items = copyItems(markdown);
  assert.equal(items[0].content, markdown);
  const codes = items.filter((item) => item.kind === "code");
  assert.equal(codes.length, 1);
  assert.equal(codes[0].title, "Code 1 · md");
  assert.equal(codes[0].content, "# Not a section\n```js\nconst x = 1\n```");
  const sections = items.filter((item) => item.kind === "section");
  assert.equal(sections.length, 2);
  assert.ok(sections[0].content.includes("````md"));
  assert.equal(sections[1].content, "## Second\n\nWorld");
});

test("finds code in lists and blockquotes without inventing sections", () => {
  const items = copyItems("> ~~~sh\n> echo hi\n> ~~~\n\n- example:\n\n    ```js\n    const x = 1;\n    ```\n");
  assert.deepEqual(items.filter((item) => item.kind === "code").map((item) => item.content), ["echo hi", "const x = 1;"]);
  assert.equal(items.filter((item) => item.kind === "section").length, 0);
  assert.equal(copyItems("just text").length, 1);
});

test("table copies preserve Markdown or produce clean rows, columns, and cells", () => {
  const markdown = "| Name | Value |\n| --- | --- |\n| **Faye** | [site](https://example.com) |\n| `code` | a\\|b |\n| Empty | |\n";
  const item = copyItems(markdown).find((item) => item.table)!;
  assert.equal(item.title, "Table 1");
  assert.equal(item.content, markdown);
  assert.deepEqual(item.table, {
    headers: ["Name", "Value"],
    rows: [["Faye", "site"], ["code", "a|b"], ["Empty", ""]],
  });
  assert.equal(tableRows(item.table!)[1].content, "Faye\tsite");
  assert.equal(tableColumns(item.table!)[1].content, "Value\nsite\na|b\n");
  assert.equal(tableCells(item.table!).at(-1)?.content, "");
});

test("picker previews strip terminal controls, collapse whitespace, and bound length", () => {
  assert.equal(preview("x\n\x1b\x07 y"), "x y");
  assert.equal(Array.from(preview("🦈".repeat(100))).length, 46);
});
