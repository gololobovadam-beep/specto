import ReactMarkdown, { type Components } from "react-markdown";
import { MARKDOWN_REMARK_PLUGINS, prepareMarkdownForDisplay } from "../utils/markdown";

interface MarkdownRendererProps {
  markdown: string;
  className?: string;
  emptyFallback?: string;
}

const MARKDOWN_COMPONENTS: Components = {
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
