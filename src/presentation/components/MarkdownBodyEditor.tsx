import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";
import { sanitizeRichTextHtml } from "../utils/topicContent";

interface MarkdownBodyEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface ToolbarState {
  isParagraph: boolean;
  isHeading1: boolean;
  isHeading2: boolean;
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrike: boolean;
  isInlineCode: boolean;
  isBulletList: boolean;
  isOrderedList: boolean;
  isBlockquote: boolean;
  isCodeBlock: boolean;
  isLink: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

const EMPTY_HTML = "";
const EMPTY_EDITOR_HTML = "<p></p>";
const DEFAULT_TOOLBAR_STATE: ToolbarState = {
  isParagraph: false,
  isHeading1: false,
  isHeading2: false,
  isBold: false,
  isItalic: false,
  isUnderline: false,
  isStrike: false,
  isInlineCode: false,
  isBulletList: false,
  isOrderedList: false,
  isBlockquote: false,
  isCodeBlock: false,
  isLink: false,
  canUndo: false,
  canRedo: false
};

export function MarkdownBodyEditor({
  value,
  onChange,
  placeholder = "Write the topic here. The result you see in the editor is exactly what will be saved."
}: MarkdownBodyEditorProps) {
  const latestValueRef = useRef(value);
  const [toolbarState, setToolbarState] = useState<ToolbarState>(DEFAULT_TOOLBAR_STATE);

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
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https"
      }),
      Underline
    ],
    content: normalizeEditorValue(value),
    editorProps: {
      attributes: {
        class: "rich-editor__content markdown-body"
      }
    },
    onCreate: ({ editor: currentEditor }) => {
      setToolbarState(readToolbarState(currentEditor));
    },
    onUpdate: ({ editor: currentEditor }) => {
      setToolbarState(readToolbarState(currentEditor));
      const nextValue = getSerializedEditorHtml(currentEditor);
      if (nextValue === latestValueRef.current) {
        return;
      }

      latestValueRef.current = nextValue;
      onChange(nextValue);
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      setToolbarState(readToolbarState(currentEditor));
    },
    onFocus: ({ editor: currentEditor }) => {
      setToolbarState(readToolbarState(currentEditor));
    },
    onBlur: ({ editor: currentEditor }) => {
      setToolbarState(readToolbarState(currentEditor));
    }
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const currentValue = normalizeEditorValue(getSerializedEditorHtml(editor));
    const nextValue = normalizeEditorValue(value);
    if (currentValue === nextValue) {
      return;
    }

    editor.commands.setContent(nextValue || EMPTY_EDITOR_HTML, {
      emitUpdate: false
    });
    setToolbarState(readToolbarState(editor));
  }, [editor, value]);

  function applyCommand(command: () => boolean) {
    if (!editor) {
      return;
    }

    command();
  }

  function handleLinkAction() {
    if (!editor) {
      return;
    }

    const currentHref = editor.getAttributes("link").href as string | undefined;
    const nextHref = window.prompt("Enter a URL", currentHref ?? "https://");
    if (nextHref === null) {
      return;
    }

    const trimmedHref = nextHref.trim();
    if (!trimmedHref) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    const normalizedHref = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmedHref) || trimmedHref.startsWith("/") || trimmedHref.startsWith("#")
      ? trimmedHref
      : `https://${trimmedHref}`;

    editor.chain().focus().extendMarkRange("link").setLink({ href: normalizedHref }).run();
  }

  const toolbarButtons = [
    {
      key: "paragraph",
      label: "P",
      title: "Paragraph",
      active: toolbarState.isParagraph,
      disabled: !editor,
      onClick: () => applyCommand(() => editor?.chain().focus().setParagraph().run() ?? false)
    },
    {
      key: "heading1",
      label: "H1",
      title: "Heading 1",
      active: toolbarState.isHeading1,
      disabled: !editor,
      onClick: () => applyCommand(() => editor?.chain().focus().toggleHeading({ level: 1 }).run() ?? false)
    },
    {
      key: "heading2",
      label: "H2",
      title: "Heading 2",
      active: toolbarState.isHeading2,
      disabled: !editor,
      onClick: () => applyCommand(() => editor?.chain().focus().toggleHeading({ level: 2 }).run() ?? false)
    },
    {
      key: "bold",
      label: "Bold",
      title: "Bold",
      active: toolbarState.isBold,
      disabled: !(editor?.can().chain().focus().toggleBold().run() ?? false),
      onClick: () => applyCommand(() => editor?.chain().focus().toggleBold().run() ?? false)
    },
    {
      key: "italic",
      label: "Italic",
      title: "Italic",
      active: toolbarState.isItalic,
      disabled: !(editor?.can().chain().focus().toggleItalic().run() ?? false),
      onClick: () => applyCommand(() => editor?.chain().focus().toggleItalic().run() ?? false)
    },
    {
      key: "underline",
      label: "Underline",
      title: "Underline",
      active: toolbarState.isUnderline,
      disabled: !(editor?.can().chain().focus().toggleUnderline().run() ?? false),
      onClick: () => applyCommand(() => editor?.chain().focus().toggleUnderline().run() ?? false)
    },
    {
      key: "strike",
      label: "Strike",
      title: "Strike-through",
      active: toolbarState.isStrike,
      disabled: !(editor?.can().chain().focus().toggleStrike().run() ?? false),
      onClick: () => applyCommand(() => editor?.chain().focus().toggleStrike().run() ?? false)
    },
    {
      key: "inline-code",
      label: "Code",
      title: "Inline code",
      active: toolbarState.isInlineCode,
      disabled: !(editor?.can().chain().focus().toggleCode().run() ?? false),
      onClick: () => applyCommand(() => editor?.chain().focus().toggleCode().run() ?? false)
    },
    {
      key: "link",
      label: "Link",
      title: "Set link",
      active: toolbarState.isLink,
      disabled: !editor,
      onClick: handleLinkAction
    },
    {
      key: "bullet-list",
      label: "Bullet",
      title: "Bullet list",
      active: toolbarState.isBulletList,
      disabled: !(editor?.can().chain().focus().toggleBulletList().run() ?? false),
      onClick: () => applyCommand(() => editor?.chain().focus().toggleBulletList().run() ?? false)
    },
    {
      key: "ordered-list",
      label: "Ordered",
      title: "Ordered list",
      active: toolbarState.isOrderedList,
      disabled: !(editor?.can().chain().focus().toggleOrderedList().run() ?? false),
      onClick: () => applyCommand(() => editor?.chain().focus().toggleOrderedList().run() ?? false)
    },
    {
      key: "blockquote",
      label: "Quote",
      title: "Blockquote",
      active: toolbarState.isBlockquote,
      disabled: !(editor?.can().chain().focus().toggleBlockquote().run() ?? false),
      onClick: () => applyCommand(() => editor?.chain().focus().toggleBlockquote().run() ?? false)
    },
    {
      key: "code-block",
      label: "Block",
      title: "Code block",
      active: toolbarState.isCodeBlock,
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
      disabled: !toolbarState.canUndo,
      onClick: () => applyCommand(() => editor?.chain().focus().undo().run() ?? false)
    },
    {
      key: "redo",
      label: "Redo",
      title: "Redo",
      active: false,
      disabled: !toolbarState.canRedo,
      onClick: () => applyCommand(() => editor?.chain().focus().redo().run() ?? false)
    }
  ];

  return (
    <div className="rich-editor">
      <div className="rich-editor__shell">
        <div className="rich-editor__toolbar" role="toolbar" aria-label="Rich text editor toolbar">
          {toolbarButtons.map((button) => (
            <button
              key={button.key}
              type="button"
              title={button.title}
              disabled={button.disabled}
              className={`button button--ghost button--small rich-editor__tool ${button.active ? "rich-editor__tool--active" : ""}`.trim()}
              onMouseDown={(event) => event.preventDefault()}
              onClick={button.onClick}
            >
              {button.label}
            </button>
          ))}
        </div>
        <div className="rich-editor__canvas">
          <EditorContent editor={editor} />
        </div>
      </div>
      <p className="field__hint rich-editor__hint">
        Visual editing is the source of truth now: what you see here is what gets saved and shown later.
      </p>
    </div>
  );
}

function readToolbarState(editor: NonNullable<ReturnType<typeof useEditor>>): ToolbarState {
  return {
    isParagraph: editor.isActive("paragraph"),
    isHeading1: editor.isActive("heading", { level: 1 }),
    isHeading2: editor.isActive("heading", { level: 2 }),
    isBold: editor.isActive("bold"),
    isItalic: editor.isActive("italic"),
    isUnderline: editor.isActive("underline"),
    isStrike: editor.isActive("strike"),
    isInlineCode: editor.isActive("code"),
    isBulletList: editor.isActive("bulletList"),
    isOrderedList: editor.isActive("orderedList"),
    isBlockquote: editor.isActive("blockquote"),
    isCodeBlock: editor.isActive("codeBlock"),
    isLink: editor.isActive("link"),
    canUndo: editor.can().chain().focus().undo().run(),
    canRedo: editor.can().chain().focus().redo().run()
  };
}

function getSerializedEditorHtml(editor: NonNullable<ReturnType<typeof useEditor>>) {
  return editor.isEmpty ? EMPTY_HTML : sanitizeRichTextHtml(editor.getHTML());
}

function normalizeEditorValue(value: string) {
  return value.trim() ? sanitizeRichTextHtml(value) : EMPTY_EDITOR_HTML;
}
