import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { stripMarkdownToText } from "../utils/markdown";

describe("MarkdownRenderer", () => {
  it("renders directive blocks and preserves custom classes", () => {
    render(
      <MarkdownRenderer
        className="markdown-body"
        markdown={":::warning{.callout}\nDirective body with :badge[label]{.pill}\n:::"}
      />
    );

    const block = document.querySelector(".markdown-directive--warning.callout");
    const inline = document.querySelector(".markdown-directive--badge.pill");

    expect(block).toBeInTheDocument();
    expect(block).toHaveTextContent("Directive body with label");
    expect(inline).toBeInTheDocument();
    expect(screen.getByText("label")).toBeVisible();
  });

  it("strips directive syntax from plain-text previews", () => {
    expect(stripMarkdownToText(":::warning{.callout}\nDirective body with :badge[label]{.pill}\n:::"))
      .toBe("Directive body with label");
  });
});
