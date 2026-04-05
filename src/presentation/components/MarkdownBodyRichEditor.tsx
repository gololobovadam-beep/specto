import "@mdxeditor/editor/style.css";
import {
  AdmonitionDirectiveDescriptor,
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  codeBlockPlugin,
  codeMirrorPlugin,
  CreateLink,
  diffSourcePlugin,
  DiffSourceToggleWrapper,
  directivesPlugin,
  GenericDirectiveEditor,
  headingsPlugin,
  InsertAdmonition,
  InsertCodeBlock,
  InsertTable,
  InsertThematicBreak,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  ListsToggle,
  markdownShortcutPlugin,
  MDXEditor,
  type MDXEditorMethods,
  quotePlugin,
  StrikeThroughSupSubToggles,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  type DirectiveDescriptor,
  UndoRedo,
  type ViewMode
} from "@mdxeditor/editor";
import { useEffect, useMemo, useRef, useState } from "react";

export interface MarkdownBodyEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface MarkdownParseError {
  error: string;
  source: string;
}

const CODE_BLOCK_LANGUAGES = {
  text: "Plain text",
  ts: "TypeScript",
  tsx: "TSX",
  js: "JavaScript",
  jsx: "JSX",
  json: "JSON",
  bash: "Bash",
  css: "CSS",
  html: "HTML",
  md: "Markdown"
} as const;

const DIRECTIVE_DESCRIPTORS: DirectiveDescriptor[] = [
  AdmonitionDirectiveDescriptor,
  createGenericDirectiveDescriptor("textDirective", true),
  createGenericDirectiveDescriptor("leafDirective", false),
  createGenericDirectiveDescriptor("containerDirective", true)
];

export function MarkdownBodyRichEditor({
  value,
  onChange,
  placeholder = "# Main idea\n\nExplain the topic in a few paragraphs.\n\n- First key point\n- Example or note"
}: MarkdownBodyEditorProps) {
  const editorRef = useRef<MDXEditorMethods | null>(null);
  const lastEmittedMarkdownRef = useRef(value);
  const [overlayContainer, setOverlayContainer] = useState<HTMLDivElement | null>(null);
  const [editorInstanceKey, setEditorInstanceKey] = useState(0);
  const [preferredViewMode, setPreferredViewMode] = useState<ViewMode>("rich-text");
  const [parseError, setParseError] = useState<MarkdownParseError | null>(null);

  const plugins = useMemo(
    () => [
      toolbarPlugin({
        toolbarContents: () => (
          <DiffSourceToggleWrapper
            options={["rich-text", "source"]}
            SourceToolbar={<span className="markdown-editor__source-label">Editing markdown source directly.</span>}
          >
            <UndoRedo />
            <BlockTypeSelect />
            <BoldItalicUnderlineToggles options={["Bold", "Italic"]} />
            <StrikeThroughSupSubToggles options={["Strikethrough"]} />
            <ListsToggle options={["bullet", "number"]} />
            <CreateLink />
            <InsertTable />
            <InsertCodeBlock />
            <InsertThematicBreak />
            <InsertAdmonition />
          </DiffSourceToggleWrapper>
        )
      }),
      diffSourcePlugin({ viewMode: preferredViewMode }),
      headingsPlugin({ allowedHeadingLevels: [1, 2, 3] }),
      listsPlugin(),
      quotePlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      tablePlugin(),
      thematicBreakPlugin(),
      codeBlockPlugin({ defaultCodeBlockLanguage: "text" }),
      codeMirrorPlugin({ codeBlockLanguages: CODE_BLOCK_LANGUAGES }),
      markdownShortcutPlugin(),
      directivesPlugin({
        directiveDescriptors: DIRECTIVE_DESCRIPTORS,
        escapeUnknownTextDirectives: true
      })
    ],
    [preferredViewMode]
  );

  useEffect(() => {
    const isExternalUpdate = value !== lastEmittedMarkdownRef.current;
    if (!isExternalUpdate) {
      return;
    }

    setParseError(null);

    if (preferredViewMode !== "rich-text") {
      setPreferredViewMode("rich-text");
      setEditorInstanceKey((current) => current + 1);
      return;
    }

    editorRef.current?.setMarkdown(value);
  }, [preferredViewMode, value]);

  function handleChange(nextValue: string) {
    lastEmittedMarkdownRef.current = nextValue;
    if (parseError) {
      setParseError(null);
    }
    onChange(nextValue);
  }

  function handleError(payload: MarkdownParseError) {
    setParseError(payload);

    // Re-open in source mode so unsupported markdown is still editable without data loss.
    if (preferredViewMode !== "source") {
      setPreferredViewMode("source");
      setEditorInstanceKey((current) => current + 1);
    }
  }

  function handleRetryRichText() {
    setParseError(null);
    setPreferredViewMode("rich-text");
    setEditorInstanceKey((current) => current + 1);
  }

  return (
    <div className="markdown-editor">
      <div ref={setOverlayContainer} className="markdown-editor__panel">
        <MDXEditor
          key={`${editorInstanceKey}:${preferredViewMode}`}
          ref={editorRef}
          className="mdxeditor markdown-editor__mdx"
          contentEditableClassName="markdown-editor__content"
          markdown={value}
          onChange={(nextValue: string) => handleChange(nextValue)}
          onError={handleError}
          placeholder={<div className="markdown-editor__placeholder">{placeholder}</div>}
          overlayContainer={overlayContainer}
          plugins={plugins}
          spellCheck={false}
          trim={false}
          suppressHtmlProcessing
        />
      </div>

      {parseError ? (
        <div className="field__hint markdown-editor__status" role="status" aria-live="polite">
          Visual mode hit markdown it could not safely map. Source mode was opened to prevent data loss.
          <button
            type="button"
            className="button button--ghost button--small markdown-editor__status-action"
            onClick={handleRetryRichText}
          >
            Try visual mode again
          </button>
        </div>
      ) : null}

      <p className="field__hint markdown-editor__hint">
        Format content visually, or switch to source mode for raw markdown and custom directives. Saved content still stays markdown.
      </p>
    </div>
  );
}

function createGenericDirectiveDescriptor(
  type: "containerDirective" | "leafDirective" | "textDirective",
  hasChildren: boolean
): DirectiveDescriptor {
  return {
    name: `generic-${type}`,
    type,
    testNode: (node: { type: string }) => node.type === type,
    attributes: ["class", "className", "title"],
    hasChildren,
    Editor: GenericDirectiveEditor
  };
}
