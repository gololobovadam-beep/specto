import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { stripMarkdownToText } from "../utils/markdown";

describe("MarkdownRenderer", () => {
  it("renders directive blocks and preserves custom classes", () => {
    render(
      <MarkdownRenderer
        className="markdown-body"
        markdown={":::yellow-block{.callout}\nDirective body with :badge[label]{.pill} and :red-text[alert]\n:::"}
      />
    );

    const block = document.querySelector(".markdown-directive--yellow-block.callout");
    const inline = document.querySelector(".markdown-directive--badge.pill");
    const coloredText = document.querySelector(".markdown-directive--red-text");

    expect(block).toBeInTheDocument();
    expect(block).toHaveTextContent("Directive body with label and alert");
    expect(inline).toBeInTheDocument();
    expect(coloredText).toBeInTheDocument();
    expect(screen.getByText("label")).toBeVisible();
    expect(screen.getByText("alert")).toBeVisible();
  });

  it("wraps tables in a scroll container without stretching them to full width", () => {
    render(<MarkdownRenderer className="markdown-body" markdown={"| A | B |\n| - | - |\n| 1 | 2 |"} />);

    const tableWrapper = document.querySelector(".markdown-table-wrap");

    expect(tableWrapper).toBeInTheDocument();
    expect(tableWrapper?.querySelector("table")).toBeInTheDocument();
  });

  it("preserves extra blank lines between blocks as compact viewer spacers", () => {
    render(<MarkdownRenderer className="markdown-body" markdown={"First paragraph\n\n\nSecond paragraph"} />);

    const spacer = document.querySelector(".markdown-spacer");

    expect(screen.getByText("First paragraph")).toBeVisible();
    expect(screen.getByText("Second paragraph")).toBeVisible();
    expect(spacer).toBeInTheDocument();
    expect(spacer).toHaveAttribute("data-lines", "1");
  });

  it("strips directive syntax from plain-text previews", () => {
    expect(stripMarkdownToText(":::yellow-block{.callout}\nDirective body with :badge[label]{.pill} and :red-text[alert]\n:::"))
      .toBe("Directive body with label and alert");
  });
});
