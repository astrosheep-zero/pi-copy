import { lexer, type Token, type Tokens } from "marked";

export interface TableData {
  headers: string[];
  rows: string[][];
}

export type CopyKind = "full" | "code" | "section" | "table";

export interface CopyItem {
  kind: CopyKind;
  title: string;
  content: string;
  table?: TableData;
}

export function preview(text: string): string {
  const clean = text.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim();
  const chars = Array.from(clean);
  return chars.length > 45 ? chars.slice(0, 45).join("") + "…" : clean;
}

function inlineText(tokens: readonly Token[]): string {
  return tokens.map((token): string => {
    if (token.type === "br") return "\n";
    if (token.type === "html") return "";
    if ("tokens" in token && Array.isArray(token.tokens)) return inlineText(token.tokens);
    return "text" in token && typeof token.text === "string" ? token.text : token.raw;
  }).join("");
}

function tableData(token: Tokens.Table): TableData {
  const cell = (value: Tokens.TableCell) => inlineText(value.tokens);
  return { headers: token.header.map(cell), rows: token.rows.map((row) => row.map(cell)) };
}

export function copyItems(markdown: string): CopyItem[] {
  const tokens = lexer(markdown);
  const items: CopyItem[] = [{ kind: "full", title: "Full response", content: markdown }];
  let codes = 0;
  let tables = 0;
  const visit = (tokens: readonly Token[]) => {
    for (const token of tokens) {
      if (token.type === "code") {
        const title = `Code ${++codes} · ${token.lang || "text"}`;
        items.push({ kind: "code", title, content: token.text });
      } else if (token.type === "table") {
        const table = tableData(token as Tokens.Table);
        items.push({
          kind: "table",
          title: `Table ${++tables}`,
          content: token.raw,
          table,
        });
      } else if (token.type === "list") {
        for (const item of token.items) visit(item.tokens);
      } else if (token.type === "blockquote") {
        visit(token.tokens ?? []);
      }
    }
  };
  visit(tokens);

  // Split only top-level headings/rules; Markdown inside code stays code.
  const sections: { title: string; text: string }[] = [];
  let text = "";
  let title = "";
  const flush = () => {
    if (text.trim()) sections.push({ title: title || preview(text), text });
    text = "";
    title = "";
  };
  for (const token of tokens) {
    if (token.type === "heading" || token.type === "hr") flush();
    if (token.type === "hr") continue;
    if (token.type === "heading") title = inlineText(token.tokens ?? []);
    text += token.raw;
  }
  flush();
  if (sections.length > 1) {
    sections.forEach((section, i) => items.push({
      kind: "section",
      title: `Section ${i + 1}`,
      content: section.text.trim(),
    }));
  }
  return items;
}

export function tableRows(table: TableData): CopyItem[] {
  return [table.headers, ...table.rows].map((row, i) => ({
    kind: "table",
    title: i === 0 ? "Header" : `Row ${i}`,
    content: row.join("\t"),
  }));
}

export function tableColumns(table: TableData): CopyItem[] {
  return table.headers.map((header, i) => ({
    kind: "table",
    title: `Column ${i + 1}`,
    content: [header, ...table.rows.map((row) => row[i] ?? "")].join("\n"),
  }));
}

export function tableCells(table: TableData): CopyItem[] {
  return [table.headers, ...table.rows].flatMap((row, r) => row.map((content, c) => ({
    kind: "table",
    title: `${r === 0 ? "Header" : "Row " + r}, col ${c + 1}`,
    content,
  })));
}
