import ReactMarkdown from "react-markdown";
import { MARKDOWN_REMARK_PLUGINS, prepareMarkdownForDisplay } from "../utils/markdown";

interface MarkdownRendererProps {
  markdown: string;
  className?: string;
  emptyFallback?: string;
}

export function MarkdownRenderer({
  markdown,
  className,
  emptyFallback = "No content yet."
}: MarkdownRendererProps) {
  const content = prepareMarkdownForDisplay(markdown);

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={MARKDOWN_REMARK_PLUGINS}>
        {content.trim() ? content : emptyFallback}
      </ReactMarkdown>
    </div>
  );
}
