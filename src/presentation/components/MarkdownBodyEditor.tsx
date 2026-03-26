import { useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";

interface MarkdownBodyEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface SelectionEditResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

type TextTransformer = (value: string, selectionStart: number, selectionEnd: number) => SelectionEditResult;

interface ToolbarAction {
  key: string;
  label: string;
  title: string;
  onApply: (value: string, selectionStart: number, selectionEnd: number) => SelectionEditResult;
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { key: "h1", label: "H1", title: "Heading 1", onApply: (value, start, end) => prefixSelectedLines(value, start, end, "# ") },
  { key: "h2", label: "H2", title: "Heading 2", onApply: (value, start, end) => prefixSelectedLines(value, start, end, "## ") },
  { key: "bold", label: "Bold", title: "Bold", onApply: (value, start, end) => wrapSelection(value, start, end, "**", "**", "bold") },
  { key: "italic", label: "Italic", title: "Italic", onApply: (value, start, end) => wrapSelection(value, start, end, "*", "*", "italic") },
  { key: "strike", label: "Strike", title: "Strike-through", onApply: (value, start, end) => wrapSelection(value, start, end, "~~", "~~", "text") },
  { key: "inline-code", label: "Code", title: "Inline code", onApply: (value, start, end) => wrapSelection(value, start, end, "`", "`", "code") },
  { key: "bullet", label: "Bullet", title: "Bullet list", onApply: (value, start, end) => prefixSelectedLines(value, start, end, "- ") },
  { key: "ordered", label: "Ordered", title: "Ordered list", onApply: (value, start, end) => prefixSelectedLines(value, start, end, "", true) },
  { key: "quote", label: "Quote", title: "Blockquote", onApply: (value, start, end) => prefixSelectedLines(value, start, end, "> ") },
  { key: "block", label: "Block", title: "Code block", onApply: (value, start, end) => wrapCodeBlock(value, start, end) },
  { key: "rule", label: "Rule", title: "Horizontal rule", onApply: (value, start, end) => insertSnippet(value, start, end, "\n\n---\n\n", 2) }
];

export function MarkdownBodyEditor({
  value,
  onChange,
  placeholder = "# Main idea\n\nExplain the topic in a few paragraphs.\n\n- First key point\n- Example or note"
}: MarkdownBodyEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function focusSelection(selectionStart: number, selectionEnd: number) {
    window.requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }

      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  function applyTextTransform(transform: TextTransformer) {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const result = transform(value, textarea.selectionStart, textarea.selectionEnd);
    onChange(result.value);
    focusSelection(result.selectionStart, result.selectionEnd);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Tab") {
      event.preventDefault();
      applyTextTransform((currentValue, selectionStart, selectionEnd) =>
        event.shiftKey
          ? unindentSelection(currentValue, selectionStart, selectionEnd)
          : indentSelection(currentValue, selectionStart, selectionEnd)
      );
      return;
    }

    if (!(event.metaKey || event.ctrlKey) || event.altKey) {
      return;
    }

    const shortcutKey = event.key.toLowerCase();
    if (shortcutKey === "b") {
      event.preventDefault();
      applyTextTransform((currentValue, selectionStart, selectionEnd) =>
        wrapSelection(currentValue, selectionStart, selectionEnd, "**", "**", "bold")
      );
      return;
    }

    if (shortcutKey === "i") {
      event.preventDefault();
      applyTextTransform((currentValue, selectionStart, selectionEnd) =>
        wrapSelection(currentValue, selectionStart, selectionEnd, "*", "*", "italic")
      );
    }
  }

  return (
    <div className="markdown-editor">
      <div className="markdown-editor__panel">
        <div className="markdown-editor__toolbar" role="toolbar" aria-label="Markdown editor toolbar">
          {TOOLBAR_ACTIONS.map((action) => (
            <button
              key={action.key}
              type="button"
              title={action.title}
              className="button button--ghost button--small markdown-editor__tool"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyTextTransform(action.onApply)}
            >
              {action.label}
            </button>
          ))}
        </div>

        <textarea
          ref={textareaRef}
          className="markdown-editor__input"
          rows={16}
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
      </div>

      <p className="field__hint markdown-editor__hint">
        One editor, plain markdown. What you type is what gets saved. Tab indents, Shift+Tab unindents, Ctrl/Cmd+B and Ctrl/Cmd+I work too.
      </p>
    </div>
  );
}

function wrapSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string,
  suffix: string,
  placeholder: string
): SelectionEditResult {
  const selectedText = value.slice(selectionStart, selectionEnd);
  const content = selectedText || placeholder;
  const nextValue = `${value.slice(0, selectionStart)}${prefix}${content}${suffix}${value.slice(selectionEnd)}`;
  const contentStart = selectionStart + prefix.length;
  const contentEnd = contentStart + content.length;

  return {
    value: nextValue,
    selectionStart: selectedText ? contentStart : contentStart,
    selectionEnd: selectedText ? contentEnd : contentEnd
  };
}

function wrapCodeBlock(value: string, selectionStart: number, selectionEnd: number): SelectionEditResult {
  const selectedText = value.slice(selectionStart, selectionEnd);
  const content = selectedText || "\n";
  const blockPrefix = "```\n";
  const blockSuffix = "\n```";
  const nextValue = `${value.slice(0, selectionStart)}${blockPrefix}${content}${blockSuffix}${value.slice(selectionEnd)}`;
  const cursorStart = selectionStart + blockPrefix.length;
  const cursorEnd = cursorStart + content.length;

  return {
    value: nextValue,
    selectionStart: selectedText ? cursorStart : cursorStart,
    selectionEnd: selectedText ? cursorEnd : cursorStart
  };
}

function insertSnippet(value: string, selectionStart: number, selectionEnd: number, snippet: string, cursorOffset: number): SelectionEditResult {
  const nextValue = `${value.slice(0, selectionStart)}${snippet}${value.slice(selectionEnd)}`;
  const nextCursor = selectionStart + cursorOffset;

  return {
    value: nextValue,
    selectionStart: nextCursor,
    selectionEnd: nextCursor
  };
}

function prefixSelectedLines(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string,
  enumerate = false
): SelectionEditResult {
  const lineStart = value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
  const lineEndCandidate = value.indexOf("\n", selectionEnd);
  const lineEnd = lineEndCandidate === -1 ? value.length : lineEndCandidate;
  const selectedBlock = value.slice(lineStart, lineEnd);
  const lines = selectedBlock.split("\n");
  const nextLines = lines.map((line, index) => {
    if (!line.trim()) {
      return line;
    }

    return enumerate ? `${index + 1}. ${line}` : `${prefix}${line}`;
  });
  const nextBlock = nextLines.join("\n");
  const nextValue = `${value.slice(0, lineStart)}${nextBlock}${value.slice(lineEnd)}`;
  const startDelta = nextLines[0] && lines[0].trim() ? (enumerate ? 3 : prefix.length) : 0;
  const totalDelta = nextBlock.length - selectedBlock.length;

  return {
    value: nextValue,
    selectionStart: selectionStart + startDelta,
    selectionEnd: selectionEnd + totalDelta
  };
}

function indentSelection(value: string, selectionStart: number, selectionEnd: number): SelectionEditResult {
  const lineStart = value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
  const lineEndCandidate = value.indexOf("\n", selectionEnd);
  const lineEnd = lineEndCandidate === -1 ? value.length : lineEndCandidate;

  if (selectionStart === selectionEnd && lineStart === lineEnd) {
    const nextValue = `${value.slice(0, selectionStart)}\t${value.slice(selectionEnd)}`;
    return {
      value: nextValue,
      selectionStart: selectionStart + 1,
      selectionEnd: selectionStart + 1
    };
  }

  const block = value.slice(lineStart, lineEnd);
  const nextBlock = block
    .split("\n")
    .map((line) => (line ? `\t${line}` : line))
    .join("\n");
  const nextValue = `${value.slice(0, lineStart)}${nextBlock}${value.slice(lineEnd)}`;
  const indentedLineCount = block.split("\n").filter((line) => line.length > 0).length;

  return {
    value: nextValue,
    selectionStart: selectionStart + 1,
    selectionEnd: selectionEnd + indentedLineCount
  };
}

function unindentSelection(value: string, selectionStart: number, selectionEnd: number): SelectionEditResult {
  const lineStart = value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
  const lineEndCandidate = value.indexOf("\n", selectionEnd);
  const lineEnd = lineEndCandidate === -1 ? value.length : lineEndCandidate;

  if (selectionStart === selectionEnd && value.slice(Math.max(0, selectionStart - 1), selectionStart) === "\t") {
    const nextValue = `${value.slice(0, selectionStart - 1)}${value.slice(selectionEnd)}`;
    return {
      value: nextValue,
      selectionStart: selectionStart - 1,
      selectionEnd: selectionStart - 1
    };
  }

  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");
  let removedBeforeStart = 0;
  let removedTotal = 0;

  const nextLines = lines.map((line, index) => {
    if (line.startsWith("\t")) {
      removedTotal += 1;
      if (index === 0) {
        removedBeforeStart = 1;
      }
      return line.slice(1);
    }

    if (line.startsWith("    ")) {
      removedTotal += 4;
      if (index === 0) {
        removedBeforeStart = 4;
      }
      return line.slice(4);
    }

    return line;
  });

  const nextBlock = nextLines.join("\n");
  const nextValue = `${value.slice(0, lineStart)}${nextBlock}${value.slice(lineEnd)}`;

  return {
    value: nextValue,
    selectionStart: Math.max(lineStart, selectionStart - removedBeforeStart),
    selectionEnd: Math.max(lineStart, selectionEnd - removedTotal)
  };
}
