import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const globalCss = readFileSync(resolve(process.cwd(), "src/styles/global.css"), "utf8");

describe("global markdown theme tokens", () => {
  it("defines eager admonition colors for both light and dark themes", () => {
    expect(globalCss).toMatch(/:root\s*{[\s\S]*--admonitionNoteBg:/);
    expect(globalCss).toMatch(/:root\[data-theme="dark"\]\s*{[\s\S]*--admonitionNoteBg:/);
    expect(globalCss).toContain("--admonition-note-bg: var(--admonitionNoteBg);");
    expect(globalCss).toContain("--admonition-danger-border: var(--admonitionDangerBorder);");
  });

  it("keeps the markdown editor tall enough for empty drafts and wraps multiline placeholders", () => {
    expect(globalCss).toContain("--markdown-editor-min-height: 184px;");
    expect(globalCss).toMatch(
      /\.markdown-editor__mdx \[contenteditable="true"\]\.markdown-editor__content,\s*\.markdown-editor__loading-copy\s*{[\s\S]*min-height: var\(--markdown-editor-min-height\);/
    );
    expect(globalCss).toMatch(
      /\.markdown-editor__mdx \[class\*="_placeholder_"\]\s*{[\s\S]*width: 100%;[\s\S]*white-space: normal;[\s\S]*text-overflow: clip;/
    );
  });
});
