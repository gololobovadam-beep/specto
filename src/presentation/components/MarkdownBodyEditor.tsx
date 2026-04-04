import { Suspense, lazy } from "react";
import type { MarkdownBodyEditorProps } from "./MarkdownBodyRichEditor";

const MarkdownBodyRichEditor = lazy(async () => {
  const module = await import("./MarkdownBodyRichEditor");
  return { default: module.MarkdownBodyRichEditor };
});

export function MarkdownBodyEditor(props: MarkdownBodyEditorProps) {
  return (
    <Suspense fallback={<MarkdownBodyEditorFallback placeholder={props.placeholder} value={props.value} />}>
      <MarkdownBodyRichEditor {...props} />
    </Suspense>
  );
}

function MarkdownBodyEditorFallback({
  value,
  placeholder = "# Main idea\n\nExplain the topic in a few paragraphs.\n\n- First key point\n- Example or note"
}: {
  value: string;
  placeholder?: string;
}) {
  return (
    <div className="markdown-editor">
      <div className="markdown-editor__panel markdown-editor__panel--loading" aria-busy="true">
        <div className="markdown-editor__toolbar" role="status" aria-live="polite">
          <span className="markdown-editor__loading-label">Loading visual editor...</span>
        </div>
        <div className="markdown-editor__loading-surface">
          <pre className="markdown-editor__loading-copy">{value || placeholder}</pre>
        </div>
      </div>

      <p className="field__hint markdown-editor__hint">
        Loading the visual markdown editor. Your content stays stored as markdown.
      </p>
    </div>
  );
}
