import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REDO_COMMAND, UNDO_COMMAND } from "lexical";
import { EditorUndoRedoButtons, MarkdownBodyRichEditor } from "./MarkdownBodyRichEditor";

const setMarkdownSpy = vi.fn();
const diffSourcePluginSpy = vi.fn();
const useCellValuesMock = vi.fn();

vi.mock("@mdxeditor/gurx", () => ({
  useCellValues: (...args: unknown[]) => useCellValuesMock(...args)
}));

vi.mock("@mdxeditor/editor/style.css", () => ({}));

vi.mock("@mdxeditor/editor", async () => {
  const React = await import("react");

  const MockEditor = React.forwardRef(function MockEditor(props: any, ref: any) {
    React.useImperativeHandle(
      ref,
      () => ({
        setMarkdown: setMarkdownSpy,
        insertMarkdown: vi.fn(),
        focus: vi.fn(),
        getContentEditableHTML: () => "",
        getSelectionMarkdown: () => ""
      }),
      []
    );

    return (
      <div data-testid="mock-mdxeditor" className={props.className}>
        <div className={props.contentEditableClassName}>{props.placeholder}</div>
        <textarea
          aria-label="Mock markdown editor"
          value={props.markdown}
          onChange={(event) => props.onChange?.(event.target.value, false)}
        />
        <button type="button" onClick={() => props.onError?.({ error: "Parse failed", source: props.markdown })}>
          Trigger parse error
        </button>
      </div>
    );
  });

  return {
    AdmonitionDirectiveDescriptor: { name: "admonition" },
    BlockTypeSelect: () => <div>BlockTypeSelect</div>,
    BoldItalicUnderlineToggles: () => <div>BoldItalicUnderlineToggles</div>,
    codeBlockPlugin: () => ({ name: "codeBlockPlugin" }),
    codeMirrorPlugin: () => ({ name: "codeMirrorPlugin" }),
    CreateLink: () => <div>CreateLink</div>,
    diffSourcePlugin: (params: unknown) => {
      diffSourcePluginSpy(params);
      return { name: "diffSourcePlugin", params };
    },
    DiffSourceToggleWrapper: ({ children }: { children: any }) => <div>{children}</div>,
    directivesPlugin: () => ({ name: "directivesPlugin" }),
    GenericDirectiveEditor: () => <div>GenericDirectiveEditor</div>,
    headingsPlugin: () => ({ name: "headingsPlugin" }),
    InsertAdmonition: () => <div>InsertAdmonition</div>,
    InsertCodeBlock: () => <div>InsertCodeBlock</div>,
    InsertTable: () => <div>InsertTable</div>,
    InsertThematicBreak: () => <div>InsertThematicBreak</div>,
    activeEditor$: Symbol("activeEditor"),
    iconComponentFor$: Symbol("iconComponentFor"),
    linkPlugin: () => ({ name: "linkPlugin" }),
    listsPlugin: () => ({ name: "listsPlugin" }),
    ListsToggle: () => <div>ListsToggle</div>,
    markdownShortcutPlugin: () => ({ name: "markdownShortcutPlugin" }),
    MDXEditor: MockEditor,
    quotePlugin: () => ({ name: "quotePlugin" }),
    StrikeThroughSupSubToggles: () => <div>StrikeThroughSupSubToggles</div>,
    tablePlugin: () => ({ name: "tablePlugin" }),
    thematicBreakPlugin: () => ({ name: "thematicBreakPlugin" }),
    toolbarPlugin: () => ({ name: "toolbarPlugin" }),
    useTranslation: () => (_key: string, defaultValue: string) => defaultValue
  };
});

describe("MarkdownBodyRichEditor", () => {
  beforeEach(() => {
    setMarkdownSpy.mockReset();
    diffSourcePluginSpy.mockReset();
    useCellValuesMock.mockReset();
    useCellValuesMock.mockReturnValue([() => <svg aria-hidden="true" />, null]);
  });

  it("forwards markdown changes to the parent draft", () => {
    const onChange = vi.fn();

    render(<MarkdownBodyRichEditor value="**bold**" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Mock markdown editor"), {
      target: { value: "# Heading" }
    });

    expect(onChange).toHaveBeenCalledWith("# Heading");
    expect(screen.getByText(/Saved content still stays markdown/i)).toBeVisible();
  });

  it("pushes external markdown updates into the editor instance", () => {
    const { rerender } = render(<MarkdownBodyRichEditor value="Initial" onChange={vi.fn()} />);

    rerender(<MarkdownBodyRichEditor value="Changed from outside" onChange={vi.fn()} />);

    expect(setMarkdownSpy).toHaveBeenCalledWith("Changed from outside");
  });

  it("reopens in source mode after a parse error and allows retrying visual mode", () => {
    render(<MarkdownBodyRichEditor value=":::warning\nbroken" onChange={vi.fn()} />);

    expect(diffSourcePluginSpy).toHaveBeenLastCalledWith({ viewMode: "rich-text" });

    fireEvent.click(screen.getByRole("button", { name: "Trigger parse error" }));

    expect(screen.getByText(/Source mode was opened to prevent data loss/i)).toBeVisible();
    expect(diffSourcePluginSpy).toHaveBeenLastCalledWith({ viewMode: "source" });

    fireEvent.click(screen.getByRole("button", { name: /Try visual mode again/i }));

    expect(diffSourcePluginSpy).toHaveBeenLastCalledWith({ viewMode: "rich-text" });
  });

  it("dispatches undo and redo only when their own buttons are clicked", () => {
    const registerCommand = vi.fn((_command, callback: (payload: boolean) => boolean) => {
      callback(true);
      return vi.fn();
    });
    const dispatchCommand = vi.fn();

    useCellValuesMock.mockReturnValue([
      () => <svg aria-hidden="true" />,
      {
        registerCommand,
        dispatchCommand
      }
    ]);

    render(
      <div>
        <EditorUndoRedoButtons />
        <div data-testid="editor-workspace">Workspace</div>
      </div>
    );

    fireEvent.click(screen.getByTestId("editor-workspace"));

    expect(dispatchCommand).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));

    expect(dispatchCommand).toHaveBeenNthCalledWith(1, UNDO_COMMAND, undefined);
    expect(dispatchCommand).toHaveBeenNthCalledWith(2, REDO_COMMAND, undefined);
  });
});
