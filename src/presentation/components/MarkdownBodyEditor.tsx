import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { prepareMarkdownForDisplay } from "../utils/markdown";

type EditorMode = "visual" | "markdown" | "preview";

const FALLBACK_EDITOR_STATE = {
  isParagraph: false,
  isHeading1: false,
  isHeading2: false,
  isBold: false,
  isItalic: false,
  isStrike: false,
  isInlineCode: false,
  isBulletList: false,
  isOrderedList: false,
  isBlockquote: false,
  isCodeBlock: false,
  canUndo: false,
  canRedo: false
};

interface MarkdownBodyEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const MODE_LABELS: Record<EditorMode, string> = {
  visual: "Visual",
  markdown: "Markdown",
  preview: "Preview"
};

export function MarkdownBodyEditor({
  value,
  onChange,
  placeholder = "# Main idea\n\nExplain the topic in a few paragraphs.\n\n- First key point\n- Example or note"
}: MarkdownBodyEditorProps) {
  const [mode, setMode] = useState<EditorMode>("visual");
  const latestValueRef = useRef(value);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] }
      }),
      Placeholder.configure({
        placeholder
      }),
      Markdown.configure({
        markedOptions: {
          gfm: true
        },
        indentation: {
          style: "tab",
          size: 1
        }
      })
    ],
    content: value,
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: "markdown-editor__surface"
      }
    },
    onUpdate: ({ editor: nextEditor }) => {
      const nextValue = nextEditor.getMarkdown();
      if (nextValue === latestValueRef.current) {
        return;
      }

      latestValueRef.current = nextValue;
      onChange(nextValue);
    }
  });

  const editorState =
    useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      if (!currentEditor) {
        return FALLBACK_EDITOR_STATE;
      }

      return {
        isParagraph: currentEditor.isActive("paragraph"),
        isHeading1: currentEditor.isActive("heading", { level: 1 }),
        isHeading2: currentEditor.isActive("heading", { level: 2 }),
        isBold: currentEditor.isActive("bold"),
        isItalic: currentEditor.isActive("italic"),
        isStrike: currentEditor.isActive("strike"),
        isInlineCode: currentEditor.isActive("code"),
        isBulletList: currentEditor.isActive("bulletList"),
        isOrderedList: currentEditor.isActive("orderedList"),
        isBlockquote: currentEditor.isActive("blockquote"),
        isCodeBlock: currentEditor.isActive("codeBlock"),
        canUndo: currentEditor.can().chain().focus().undo().run(),
        canRedo: currentEditor.can().chain().focus().redo().run()
      };
    }
  }) ?? FALLBACK_EDITOR_STATE;

  useEffect(() => {
    if (!editor) {
      return;
    }

    const currentValue = editor.getMarkdown();
    if (currentValue === value) {
      return;
    }

    editor.commands.setContent(value, {
      contentType: "markdown",
      emitUpdate: false,
      parseOptions: {
        preserveWhitespace: "full"
      }
    });
  }, [editor, value]);

  function applyCommand(command: () => boolean) {
    if (!editor) {
      return;
    }

    command();
  }

  function handleSourceKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab") {
      return;
    }

    event.preventDefault();
    const textarea = event.currentTarget;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const nextValue = `${value.slice(0, selectionStart)}\t${value.slice(selectionEnd)}`;

    onChange(nextValue);

    window.requestAnimationFrame(() => {
      const nextPosition = selectionStart + 1;
      textarea.selectionStart = nextPosition;
      textarea.selectionEnd = nextPosition;
    });
  }

  const commandButtons = [
    {
      key: "paragraph",
      label: "P",
      title: "Paragraph",
      active: editorState.isParagraph,
      disabled: !editor,
      onClick: () => applyCommand(() => editor?.chain().focus().setParagraph().run() ?? false)
    },
    {
      key: "heading1",
      label: "H1",
      title: "Heading 1",
      active: editorState.isHeading1,
      disabled: !editor,
      onClick: () => applyCommand(() => editor?.chain().focus().toggleHeading({ level: 1 }).run() ?? false)
    },
    {
      key: "heading2",
      label: "H2",
      title: "Heading 2",
      active: editorState.isHeading2,
      disabled: !editor,
      onClick: () => applyCommand(() => editor?.chain().focus().toggleHeading({ level: 2 }).run() ?? false)
    },
    {
      key: "bold",
      label: "Bold",
      title: "Bold",
      active: editorState.isBold,
      disabled: !(editor?.can().chain().focus().toggleBold().run() ?? false),
      onClick: () => applyCommand(() => editor?.chain().focus().toggleBold().run() ?? false)
    },
    {
      key: "italic",
      label: "Italic",
      title: "Italic",
      active: editorState.isItalic,
      disabled: !(editor?.can().chain().focus().toggleItalic().run() ?? false),
      onClick: () => applyCommand(() => editor?.chain().focus().toggleItalic().run() ?? false)
    },
    {
      key: "strike",
      label: "Strike",
      title: "Strike-through",
      active: editorState.isStrike,
      disabled: !(editor?.can().chain().focus().toggleStrike().run() ?? false),
      onClick: () => applyCommand(() => editor?.chain().focus().toggleStrike().run() ?? false)
    },
    {
      key: "inline-code",
      label: "Code",
      title: "Inline code",
      active: editorState.isInlineCode,
      disabled: !(editor?.can().chain().focus().toggleCode().run() ?? false),
      onClick: () => applyCommand(() => editor?.chain().focus().toggleCode().run() ?? false)
    },
    {
      key: "bullet-list",
      label: "Bullet",
      title: "Bullet list",
      active: editorState.isBulletList,
      disabled: !(editor?.can().chain().focus().toggleBulletList().run() ?? false),
      onClick: () => applyCommand(() => editor?.chain().focus().toggleBulletList().run() ?? false)
    },
    {
      key: "ordered-list",
      label: "Ordered",
      title: "Ordered list",
      active: editorState.isOrderedList,
      disabled: !(editor?.can().chain().focus().toggleOrderedList().run() ?? false),
      onClick: () => applyCommand(() => editor?.chain().focus().toggleOrderedList().run() ?? false)
    },
    {
      key: "blockquote",
      label: "Quote",
      title: "Blockquote",
      active: editorState.isBlockquote,
      disabled: !(editor?.can().chain().focus().toggleBlockquote().run() ?? false),
      onClick: () => applyCommand(() => editor?.chain().focus().toggleBlockquote().run() ?? false)
    },
    {
      key: "code-block",
      label: "Block",
      title: "Code block",
      active: editorState.isCodeBlock,
      disabled: !(editor?.can().chain().focus().toggleCodeBlock().run() ?? false),
      onClick: () => applyCommand(() => editor?.chain().focus().toggleCodeBlock().run() ?? false)
    },
    {
      key: "rule",
      label: "Rule",
      title: "Horizontal rule",
      active: false,
      disabled: !(editor?.can().chain().focus().setHorizontalRule().run() ?? false),
      onClick: () => applyCommand(() => editor?.chain().focus().setHorizontalRule().run() ?? false)
    },
    {
      key: "undo",
      label: "Undo",
      title: "Undo",
      active: false,
      disabled: !editorState.canUndo,
      onClick: () => applyCommand(() => editor?.chain().focus().undo().run() ?? false)
    },
    {
      key: "redo",
      label: "Redo",
      title: "Redo",
      active: false,
      disabled: !editorState.canRedo,
      onClick: () => applyCommand(() => editor?.chain().focus().redo().run() ?? false)
    }
  ];

  return (
    <div className="markdown-editor">
      <div className="markdown-editor__toolbar" role="toolbar" aria-label="Markdown editor toolbar">
        <div className="markdown-editor__modes" role="tablist" aria-label="Editor mode">
          {(["visual", "markdown", "preview"] as EditorMode[]).map((nextMode) => (
            <button
              key={nextMode}
              type="button"
              role="tab"
              aria-selected={mode === nextMode}
              className={`button button--ghost button--small markdown-editor__tool ${
                mode === nextMode ? "markdown-editor__tool--active" : ""
              }`.trim()}
              onClick={() => setMode(nextMode)}
            >
              {MODE_LABELS[nextMode]}
            </button>
          ))}
        </div>
        <div className="markdown-editor__commands">
          {commandButtons.map((button) => (
            <button
              key={button.key}
              type="button"
              title={button.title}
              disabled={mode !== "visual" || button.disabled}
              className={`button button--ghost button--small markdown-editor__tool ${
                button.active ? "markdown-editor__tool--active" : ""
              }`.trim()}
              onMouseDown={(event) => event.preventDefault()}
              onClick={button.onClick}
            >
              {button.label}
            </button>
          ))}
        </div>
      </div>

      <p className="field__hint markdown-editor__hint">
        Visual mode keeps markdown as the source of truth. Markdown mode preserves the raw text exactly, including tabs.
      </p>

      <div className="markdown-editor__panel">
        {mode === "visual" ? (
          <div className="markdown-editor__canvas">
            <EditorContent editor={editor} />
          </div>
        ) : null}

        {mode === "markdown" ? (
          <textarea
            className="markdown-editor__source"
            rows={14}
            spellCheck={false}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleSourceKeyDown}
            placeholder={placeholder}
          />
        ) : null}

        {mode === "preview" ? (
          <div className="markdown-editor__preview markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {prepareMarkdownForDisplay(value) || "No content yet."}
            </ReactMarkdown>
          </div>
        ) : null}
      </div>
    </div>
  );
}
