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
});
