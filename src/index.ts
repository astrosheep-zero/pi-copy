import { copyToClipboard, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createCopyHandler } from "./command.ts";

export default function copyExtension(pi: ExtensionAPI) {
  const handler = createCopyHandler(copyToClipboard);

  pi.registerCommand("cp", {
    description: "Copy assistant output: response, code, sections, or table cells",
    getArgumentCompletions: (prefix) => {
      const subs = [
        { value: "all", label: "all", description: "Copy conversation on the current branch" },
        { value: "msg", label: "msg", description: "Pick an assistant response from this session" },
      ];
      const filtered = subs.filter((s) => s.value.startsWith(prefix));
      return filtered.length > 0 ? filtered : null;
    },
    handler,
  });

  pi.registerShortcut("ctrl+shift+c", {
    description: "Copy assistant output (pi-copy)",
    handler: async (ctx) => {
      await handler("", ctx);
    },
  });
}
