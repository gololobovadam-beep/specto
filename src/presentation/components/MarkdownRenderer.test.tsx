import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { stripMarkdownToText } from "../utils/markdown";

describe("MarkdownRenderer", () => {
  it("renders directive blocks and preserves custom classes", () => {
    render(
      <MarkdownRenderer
        className="markdown-body"
        markdown={":::yellow-block{.callout}\nDirective body with :badge[label]{.pill}\n:::"}
      />
    );

    const block = document.querySelector(".markdown-directive--yellow-block.callout");
    const inline = document.querySelector(".markdown-directive--badge.pill");

    expect(block).toBeInTheDocument();
    expect(block).toHaveTextContent("Directive body with label");
    expect(inline).toBeInTheDocument();
    expect(screen.getByText("label")).toBeVisible();
  });

  it("wraps tables in a scroll container without stretching them to full width", () => {
    render(<MarkdownRenderer className="markdown-body" markdown={"| A | B |\n| - | - |\n| 1 | 2 |"} />);

    const tableWrapper = document.querySelector(".markdown-table-wrap");

    expect(tableWrapper).toBeInTheDocument();
    expect(tableWrapper?.querySelector("table")).toBeInTheDocument();
  });

  it("strips directive syntax from plain-text previews", () => {
    expect(stripMarkdownToText(":::yellow-block{.callout}\nDirective body with :badge[label]{.pill}\n:::"))
      .toBe("Directive body with label");
  });
});
