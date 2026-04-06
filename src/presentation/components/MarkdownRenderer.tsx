import type { CSSProperties } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { MARKDOWN_REMARK_PLUGINS, prepareMarkdownForDisplay } from "../utils/markdown";

interface MarkdownRendererProps {
  markdown: string;
  className?: string;
  emptyFallback?: string;
}

const MARKDOWN_COMPONENTS: Components = {
  div: ({ node: _node, className, ...props }) => {
    if (hasMarkdownClassName(className, "markdown-directive--spacer")) {
      const lineCount = getDisplaySpacerLineCount((props as Record<string, unknown>)["data-lines"]);
      return (
        <div
          aria-hidden="true"
          className="markdown-spacer"
          data-lines={lineCount}
          style={{ "--markdown-spacer-lines": String(lineCount) } as CSSProperties}
        />
      );
    }

    return <div className={normalizeMarkdownClassName(className)} {...props} />;
  },
  table: ({ node: _node, ...props }) => (
    <div className="markdown-table-wrap">
      <table {...props} />
    </div>
  )
};

export function MarkdownRenderer({
  markdown,
  className,
  emptyFallback = "No content yet."
}: MarkdownRendererProps) {
  const content = prepareMarkdownForDisplay(markdown);

  return (
    <div className={className}>
      <ReactMarkdown components={MARKDOWN_COMPONENTS} remarkPlugins={MARKDOWN_REMARK_PLUGINS}>
        {content.trim() ? content : emptyFallback}
      </ReactMarkdown>
    </div>
  );
}

function hasMarkdownClassName(value: unknown, target: string) {
  return normalizeMarkdownClassName(value)
    .split(/\s+/)
    .filter(Boolean)
    .includes(target);
}

function normalizeMarkdownClassName(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").join(" ");
  }

  return "";
}

function getDisplaySpacerLineCount(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}
