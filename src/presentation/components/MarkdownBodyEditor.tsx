import {
  useEffect,
  useRef,
  type FormEvent as ReactFormEvent,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";
import {
  MARKDOWN_TOOLBAR_ACTIONS,
  indentSelection,
  unindentSelection,
  wrapSelection,
  type TextTransformer
} from "../utils/markdown";

interface MarkdownBodyEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface HistoryEntry {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export function MarkdownBodyEditor({
  value,
  onChange,
  placeholder = "# Main idea\n\nExplain the topic in a few paragraphs.\n\n- First key point\n- Example or note"
}: MarkdownBodyEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const undoStackRef = useRef<HistoryEntry[]>([]);
  const redoStackRef = useRef<HistoryEntry[]>([]);
  const pendingInternalValueRef = useRef(false);

  useEffect(() => {
    if (pendingInternalValueRef.current) {
      pendingInternalValueRef.current = false;
      return;
    }

    undoStackRef.current = [];
    redoStackRef.current = [];
  }, [value]);

  function getCurrentEntry(textarea: HTMLTextAreaElement): HistoryEntry {
    return {
      value,
      selectionStart: textarea.selectionStart,
      selectionEnd: textarea.selectionEnd
    };
  }

  function pushUndoEntry(entry: HistoryEntry) {
    const lastEntry = undoStackRef.current.at(-1);
    if (
      lastEntry &&
      lastEntry.value === entry.value &&
      lastEntry.selectionStart === entry.selectionStart &&
      lastEntry.selectionEnd === entry.selectionEnd
    ) {
      return;
    }

    undoStackRef.current = [...undoStackRef.current.slice(-99), entry];
  }

  function applyNextValue(nextValue: string) {
    pendingInternalValueRef.current = true;
    onChange(nextValue);
  }

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

    pushUndoEntry(getCurrentEntry(textarea));
    redoStackRef.current = [];
    const result = transform(value, textarea.selectionStart, textarea.selectionEnd);
    applyNextValue(result.value);
    focusSelection(result.selectionStart, result.selectionEnd);
  }

  function restoreHistoryEntry(entry: HistoryEntry) {
    applyNextValue(entry.value);
    focusSelection(entry.selectionStart, entry.selectionEnd);
  }

  function handleBeforeInput(event: ReactFormEvent<HTMLTextAreaElement>) {
    if (event.defaultPrevented) {
      return;
    }

    const textarea = event.currentTarget;
    pushUndoEntry(getCurrentEntry(textarea));
    redoStackRef.current = [];
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && !event.altKey) {
      const shortcutKey = event.key.toLowerCase();

      if ((shortcutKey === "z" && event.shiftKey) || shortcutKey === "y") {
        const nextEntry = redoStackRef.current.at(-1);
        if (!nextEntry) {
          return;
        }

        event.preventDefault();
        const textarea = textareaRef.current;
        if (!textarea) {
          return;
        }

        redoStackRef.current = redoStackRef.current.slice(0, -1);
        pushUndoEntry(getCurrentEntry(textarea));
        restoreHistoryEntry(nextEntry);
        return;
      }

      if (shortcutKey === "z") {
        const previousEntry = undoStackRef.current.at(-1);
        if (!previousEntry) {
          return;
        }

        event.preventDefault();
        const textarea = textareaRef.current;
        if (!textarea) {
          return;
        }

        undoStackRef.current = undoStackRef.current.slice(0, -1);
        redoStackRef.current = [...redoStackRef.current.slice(-99), getCurrentEntry(textarea)];
        restoreHistoryEntry(previousEntry);
        return;
      }
    }

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
          {MARKDOWN_TOOLBAR_ACTIONS.map((action) => (
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
          onBeforeInput={handleBeforeInput}
          onChange={(event) => applyNextValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
      </div>

      <p className="field__hint markdown-editor__hint">
        One editor, plain markdown. What you type is what gets saved. Tab indents, Shift+Tab unindents, Ctrl/Cmd+B, Ctrl/Cmd+I, and Ctrl/Cmd+Z work too.
      </p>
    </div>
  );
}
