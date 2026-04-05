import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownBodyRichEditor } from "./MarkdownBodyRichEditor";

const setMarkdownSpy = vi.fn();
const diffSourcePluginSpy = vi.fn();

vi.mock("@mdxeditor/editor/style.css", () => ({}));

vi.mock("@mdxeditor/editor", async () => {
  const React = await import("react");
  const toolbarControl = (testId: string, label: string) => <div data-testid={testId}>{label}</div>;

  const MockEditor = React.forwardRef(function MockEditor(props: any, ref: any) {
    const toolbarPluginConfig = props.plugins?.find((plugin: { name: string }) => plugin.name === "toolbarPlugin");
    const toolbarContents = toolbarPluginConfig?.params?.toolbarContents;

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
        {typeof toolbarContents === "function" ? toolbarContents() : null}
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
    BlockTypeSelect: () => toolbarControl("library-block-type-select", "BlockTypeSelect"),
    BoldItalicUnderlineToggles: () => toolbarControl("library-bold-italic-toggles", "BoldItalicUnderlineToggles"),
    codeBlockPlugin: () => ({ name: "codeBlockPlugin" }),
    codeMirrorPlugin: () => ({ name: "codeMirrorPlugin" }),
    CreateLink: () => toolbarControl("library-create-link", "CreateLink"),
    diffSourcePlugin: (params: unknown) => {
      diffSourcePluginSpy(params);
      return { name: "diffSourcePlugin", params };
    },
    DiffSourceToggleWrapper: ({ children }: { children: any }) => (
      <div>
        {toolbarControl("library-diff-source-toggle", "DiffSourceToggleWrapper")}
        {children}
      </div>
    ),
    directivesPlugin: () => ({ name: "directivesPlugin" }),
    GenericDirectiveEditor: () => <div>GenericDirectiveEditor</div>,
    headingsPlugin: () => ({ name: "headingsPlugin" }),
    InsertAdmonition: () => toolbarControl("library-insert-admonition", "InsertAdmonition"),
    InsertCodeBlock: () => toolbarControl("library-insert-code-block", "InsertCodeBlock"),
    InsertTable: () => toolbarControl("library-insert-table", "InsertTable"),
    InsertThematicBreak: () => toolbarControl("library-insert-thematic-break", "InsertThematicBreak"),
    linkPlugin: () => ({ name: "linkPlugin" }),
    listsPlugin: () => ({ name: "listsPlugin" }),
    ListsToggle: () => toolbarControl("library-lists-toggle", "ListsToggle"),
    markdownShortcutPlugin: () => ({ name: "markdownShortcutPlugin" }),
    MDXEditor: MockEditor,
    quotePlugin: () => ({ name: "quotePlugin" }),
    StrikeThroughSupSubToggles: () => toolbarControl("library-strikethrough-toggles", "StrikeThroughSupSubToggles"),
    tablePlugin: () => ({ name: "tablePlugin" }),
    thematicBreakPlugin: () => ({ name: "thematicBreakPlugin" }),
    toolbarPlugin: (params: unknown) => ({ name: "toolbarPlugin", params }),
    UndoRedo: () => toolbarControl("library-undo-redo", "UndoRedo"),
    useTranslation: () => (_key: string, defaultValue: string) => defaultValue
  };
});

describe("MarkdownBodyRichEditor", () => {
  beforeEach(() => {
    setMarkdownSpy.mockReset();
    diffSourcePluginSpy.mockReset();
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

  it("assembles the editor toolbar from library controls", () => {
    render(<MarkdownBodyRichEditor value="Initial" onChange={vi.fn()} />);

    expect(screen.getByTestId("library-undo-redo")).toBeVisible();
    expect(screen.getByTestId("library-block-type-select")).toBeVisible();
    expect(screen.getByTestId("library-bold-italic-toggles")).toBeVisible();
    expect(screen.getByTestId("library-strikethrough-toggles")).toBeVisible();
    expect(screen.getByTestId("library-lists-toggle")).toBeVisible();
    expect(screen.getByTestId("library-create-link")).toBeVisible();
    expect(screen.getByTestId("library-insert-table")).toBeVisible();
    expect(screen.getByTestId("library-insert-code-block")).toBeVisible();
    expect(screen.getByTestId("library-insert-thematic-break")).toBeVisible();
    expect(screen.getByTestId("library-insert-admonition")).toBeVisible();
    expect(screen.getByTestId("library-diff-source-toggle")).toBeVisible();
  });
});
