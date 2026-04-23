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
      /\.markdown-editor__mdx \[class\*="_rootContentEditableWrapper_"\]\s*{[\s\S]*min-height: var\(--markdown-editor-min-height\);[\s\S]*cursor: text;/
    );
    expect(globalCss).toMatch(
      /\.markdown-editor__loading-copy\s*{[\s\S]*min-height: var\(--markdown-editor-min-height\);/
    );
    expect(globalCss).toMatch(
      /\.markdown-editor__mdx \[class\*="_placeholder_"\]\s*{[\s\S]*width: 100%;[\s\S]*white-space: normal;[\s\S]*text-overflow: clip;/
    );
    expect(globalCss).toMatch(
      /\.markdown-editor__source-label\s*{[\s\S]*line-height: 1\.2;[\s\S]*white-space: nowrap;[\s\S]*text-overflow: ellipsis;/
    );
    expect(globalCss).toMatch(
      /\.markdown-editor__mdx \[class\*="_toolbarRoot_"\]\s*{[\s\S]*min-height: 52px;/
    );
    expect(globalCss).toMatch(
      /\.markdown-editor__mdx \[class\*="_toolbarNodeKindSelectTrigger_"\],[\s\S]*background: var\(--surface-inset\) !important;[\s\S]*color: var\(--text\) !important;/
    );
    expect(globalCss).toMatch(
      /\.markdown-editor__mdx \.cm-sourceView \.cm-editor\s*{[\s\S]*padding: 0 !important;[\s\S]*background: transparent !important;/
    );
    expect(globalCss).toMatch(
      /\.markdown-editor__mdx \.cm-sourceView \.cm-scroller,[\s\S]*font-size: 1rem !important;[\s\S]*line-height: 1\.72 !important;[\s\S]*background: transparent !important;/
    );
    expect(globalCss).toMatch(
      /\.markdown-editor__mdx \.cm-sourceView \.cm-activeLine,[\s\S]*background: transparent !important;/
    );
    expect(globalCss).toMatch(
      /\.markdown-editor__mdx \.cm-gutterElement,[\s\S]*display: flex;[\s\S]*align-items: center;[\s\S]*padding-inline: 6px 14px !important;/
    );
  });
});
