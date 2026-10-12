import assert from "node:assert/strict";
import { test } from "node:test";
import { CopyPicker } from "../src/picker.ts";
import type { CopyItem } from "../src/blocks.ts";
import { fakeTheme, fakeTui } from "./fixtures.ts";

function renderPicker(items: CopyItem[]): string[] {
  const picker = new CopyPicker(fakeTui, fakeTheme, "Copy", items, () => {});
  return picker.render(80);
}

test("item titles align when badge numbers have different widths", () => {
  const items: CopyItem[] = Array.from({ length: 12 }, (_, i) => ({
    kind: "full",
    title: `Response ${i + 1}`,
    content: "x",
  }));
  const rows = renderPicker(items);
  const body = rows.filter((line) => line.includes("Response"));
  const first = body[0].indexOf("Response"); // " 1. Response 1"
  const tenth = body[9].indexOf("Response"); // "10. Response 10"
  assert.equal(first, tenth);
  assert.ok(body[0].includes(" 1."), body[0]);
  assert.ok(body[9].includes("10."), body[9]);
});

test("single-digit lists keep compact badges", () => {
  const items: CopyItem[] = [
    { kind: "full", title: "Full response", content: "x" },
    { kind: "code", title: "Code 1 · sh", content: "y" },
  ];
  const rows = renderPicker(items);
  const body = rows.filter((line) => line.includes("Full response"));
  assert.ok(body[0].includes("1. Full response"), body[0]);
});
