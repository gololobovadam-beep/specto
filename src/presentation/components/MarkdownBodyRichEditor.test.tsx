import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownBodyRichEditor } from "./MarkdownBodyRichEditor";

const mocked = vi.hoisted(() => ({
  setMarkdownSpy: vi.fn(),
  focusSpy: vi.fn(),
  diffSourcePluginSpy: vi.fn(),
  linkDialogPluginSpy: vi.fn(),
  codeBlockPluginSpy: vi.fn(),
  codeMirrorPluginSpy: vi.fn(),
  insertDirectiveSpy: vi.fn(),
  insertMarkdownSpy: vi.fn(),
  convertSelectionToNodeSpy: vi.fn(),
  activeEditorCell: { name: "activeEditor$" },
  activePluginsCell: { name: "activePlugins$" },
  allowedHeadingLevelsCell: { name: "allowedHeadingLevels$" },
  convertSelectionToNodeCell: { name: "convertSelectionToNode$" },
  currentBlockTypeCell: { name: "currentBlockType$" },
  currentListTypeCell: { name: "currentListType$" },
  editorInTableCell: { name: "editorInTable$" },
  iconComponentForCell: { name: "iconComponentFor$" },
  insertDirectiveCell: { name: "insertDirective$" },
  insertMarkdownCell: { name: "insertMarkdown$" }
}));

vi.mock("@mdxeditor/editor/style.css", () => ({}));

vi.mock("@mdxeditor/gurx", () => ({
  useCellValue: (cell: unknown) => {
    switch (cell) {
      case mocked.currentBlockTypeCell:
        return "paragraph";
      case mocked.currentListTypeCell:
        return "";
      case mocked.activeEditorCell:
        return null;
      case mocked.editorInTableCell:
        return false;
      case mocked.iconComponentForCell:
        return (name: string) => <span data-testid={`icon-${name}`}>{name}</span>;
      default:
        return undefined;
    }
  },
  useCellValues: (...cells: unknown[]) =>
    cells.map((cell) => {
      switch (cell) {
        case mocked.activePluginsCell:
          return ["quote", "headings"];
        case mocked.allowedHeadingLevelsCell:
          return [1, 2, 3];
        default:
          return undefined;
      }
    }),
  usePublisher: (cell: unknown) => {
    if (cell === mocked.insertDirectiveCell) {
      return mocked.insertDirectiveSpy;
    }

    if (cell === mocked.insertMarkdownCell) {
      return mocked.insertMarkdownSpy;
    }

    if (cell === mocked.convertSelectionToNodeCell) {
      return mocked.convertSelectionToNodeSpy;
    }

    return vi.fn();
  }
}));

vi.mock("@mdxeditor/editor", async () => {
  const React = await import("react");
  const toolbarControl = (testId: string, label: React.ReactNode) => <div data-testid={testId}>{label}</div>;

  const MockEditor = React.forwardRef(function MockEditor(props: any, ref: any) {
    const toolbarPluginConfig = props.plugins?.find((plugin: { name: string }) => plugin.name === "toolbarPlugin");
    const toolbarContents = toolbarPluginConfig?.params?.toolbarContents;

    React.useImperativeHandle(
      ref,
      () => ({
        setMarkdown: mocked.setMarkdownSpy,
        insertMarkdown: vi.fn(),
        focus: mocked.focusSpy,
        getContentEditableHTML: () => "",
        getSelectionMarkdown: () => ""
      }),
      []
    );

    return (
      <div data-testid="mock-mdxeditor" className={props.className}>
        {typeof toolbarContents === "function" ? toolbarContents() : null}
        <div
          data-testid="mock-content-surface"
          className={props.contentEditableClassName}
          contentEditable
          suppressContentEditableWarning
        >
          {props.markdown ? <span data-testid="mock-content-text">Rendered content</span> : null}
        </div>
        <div data-testid="mock-placeholder">{props.placeholder}</div>
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
    ButtonOrDropdownButton: ({ children, items, onChoose }: { children: React.ReactNode; items?: Array<{ value: string }>; onChoose?: (value: string) => void }) => {
      const testId = children === "Text Color" ? "library-insert-text-color" : "library-insert-color-block";

      return (
        <button type="button" data-testid={testId} onClick={() => onChoose?.(items?.[0]?.value ?? "") }>
          {children}
        </button>
      );
    },
    ButtonWithTooltip: ({ title, children }: { title: string; children: React.ReactNode }) => {
      if (/Insert Table/i.test(title)) {
        return toolbarControl("library-insert-table", children);
      }

      return toolbarControl("library-button-with-tooltip", children);
    },
    BoldItalicUnderlineToggles: () => toolbarControl("library-bold-italic-toggles", "BoldItalicUnderlineToggles"),
    CodeMirrorEditor: () => toolbarControl("library-code-mirror-editor", "CodeMirrorEditor"),
    CodeToggle: () => toolbarControl("library-inline-code-toggle", "CodeToggle"),
    codeBlockPlugin: (params: unknown) => {
      mocked.codeBlockPluginSpy(params);
      return { name: "codeBlockPlugin", params };
    },
    codeMirrorPlugin: (params: unknown) => {
      mocked.codeMirrorPluginSpy(params);
      return { name: "codeMirrorPlugin", params };
    },
    CreateLink: () => toolbarControl("library-create-link", "CreateLink"),
    diffSourcePlugin: (params: unknown) => {
      mocked.diffSourcePluginSpy(params);
      return { name: "diffSourcePlugin", params };
    },
    DiffSourceToggleWrapper: ({ children }: { children: React.ReactNode }) => (
      <div>
        {toolbarControl("library-diff-source-toggle", "DiffSourceToggleWrapper")}
        {children}
      </div>
    ),
    directivesPlugin: () => ({ name: "directivesPlugin" }),
    GenericDirectiveEditor: () => <div>GenericDirectiveEditor</div>,
    headingsPlugin: () => ({ name: "headingsPlugin" }),
    InsertCodeBlock: () => toolbarControl("library-insert-code-block", "InsertCodeBlock"),
    InsertThematicBreak: () => toolbarControl("library-insert-thematic-break", "InsertThematicBreak"),
    linkDialogPlugin: (params?: unknown) => {
      mocked.linkDialogPluginSpy(params);
      return { name: "linkDialogPlugin", params };
    },
    linkPlugin: () => ({ name: "linkPlugin" }),
    listsPlugin: () => ({ name: "listsPlugin" }),
    ListsToggle: () => toolbarControl("library-lists-toggle", "ListsToggle"),
    markdownShortcutPlugin: () => ({ name: "markdownShortcutPlugin" }),
    MDXEditor: MockEditor,
    NestedLexicalEditor: () => toolbarControl("library-nested-editor", "NestedLexicalEditor"),
    quotePlugin: () => ({ name: "quotePlugin" }),
    Select: ({ placeholder, disabled }: { placeholder: string; disabled?: boolean }) => (
      <div data-testid="library-block-type-select" data-disabled={disabled ? "true" : "false"}>
        {placeholder}
      </div>
    ),
    StrikeThroughSupSubToggles: () => toolbarControl("library-strikethrough-toggles", "StrikeThroughSupSubToggles"),
    tablePlugin: () => ({ name: "tablePlugin" }),
    thematicBreakPlugin: () => ({ name: "thematicBreakPlugin" }),
    toolbarPlugin: (params: unknown) => ({ name: "toolbarPlugin", params }),
    UndoRedo: () => toolbarControl("library-undo-redo", "UndoRedo"),
    useCodeBlockEditorContext: () => ({
      lexicalNode: { remove: vi.fn() },
      parentEditor: { update: (callback: () => void) => callback() },
      setLanguage: vi.fn()
    }),
    activeEditor$: mocked.activeEditorCell,
    activePlugins$: mocked.activePluginsCell,
    allowedHeadingLevels$: mocked.allowedHeadingLevelsCell,
    convertSelectionToNode$: mocked.convertSelectionToNodeCell,
    currentBlockType$: mocked.currentBlockTypeCell,
    currentListType$: mocked.currentListTypeCell,
    editorInTable$: mocked.editorInTableCell,
    iconComponentFor$: mocked.iconComponentForCell,
    insertDirective$: mocked.insertDirectiveCell,
    insertMarkdown$: mocked.insertMarkdownCell,
    useTranslation: () => (_key: string, defaultValue: string, values?: { level?: number }) =>
      defaultValue.replace("{{level}}", String(values?.level ?? ""))
  };
});

describe("MarkdownBodyRichEditor", () => {
  beforeEach(() => {
    mocked.setMarkdownSpy.mockReset();
    mocked.focusSpy.mockReset();
    mocked.diffSourcePluginSpy.mockReset();
    mocked.linkDialogPluginSpy.mockReset();
    mocked.codeBlockPluginSpy.mockReset();
    mocked.codeMirrorPluginSpy.mockReset();
    mocked.insertDirectiveSpy.mockReset();
    mocked.insertMarkdownSpy.mockReset();
    mocked.convertSelectionToNodeSpy.mockReset();
  });

  it("forwards markdown changes to the parent draft", () => {
    const onChange = vi.fn();

    render(<MarkdownBodyRichEditor value="**bold**" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Mock markdown editor"), {
      target: { value: "# Heading" }
    });

    expect(onChange).toHaveBeenCalledWith("# Heading");
  });

  it("trims trailing empty lines before saving", () => {
    const onChange = vi.fn();

    render(<MarkdownBodyRichEditor value=":::grey-block\nBody\n:::" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Mock markdown editor"), {
      target: { value: ":::grey-block\nBody\n:::\n\n\n" }
    });

    expect(onChange).toHaveBeenCalledWith(":::grey-block\nBody\n:::");
  });

  it("pushes normalized external markdown updates into the editor instance", () => {
    const { rerender } = render(<MarkdownBodyRichEditor value="Initial" onChange={vi.fn()} />);

    rerender(<MarkdownBodyRichEditor value={":::red-block\nChanged from outside\n:::"} onChange={vi.fn()} />);

    expect(mocked.setMarkdownSpy).toHaveBeenCalledWith(":::red-block\nChanged from outside\n:::");
  });

  it("focuses the editor when clicking the empty panel area", () => {
    const { container } = render(<MarkdownBodyRichEditor value="" onChange={vi.fn()} />);

    const panel = container.querySelector(".markdown-editor__panel");
    expect(panel).not.toBeNull();

    fireEvent.mouseDown(panel as HTMLElement, { button: 0 });

    expect(mocked.focusSpy).toHaveBeenCalledTimes(1);
    expect(mocked.focusSpy).toHaveBeenCalledWith(undefined, {
      defaultSelection: "rootEnd",
      preventScroll: true
    });
  });

  it("does not override clicks on actual editor content", () => {
    render(<MarkdownBodyRichEditor value="Body" onChange={vi.fn()} />);

    fireEvent.mouseDown(screen.getByTestId("mock-content-text"), { button: 0 });

    expect(mocked.focusSpy).not.toHaveBeenCalled();
  });

  it("reopens in source mode after a parse error and allows retrying visual mode", () => {
    render(<MarkdownBodyRichEditor value={":::yellow-block\nbroken"} onChange={vi.fn()} />);

    expect(mocked.diffSourcePluginSpy).toHaveBeenLastCalledWith({ viewMode: "rich-text" });

    fireEvent.click(screen.getByRole("button", { name: "Trigger parse error" }));

    expect(screen.getByText(/Source mode was opened to prevent data loss/i)).toBeVisible();
    expect(mocked.diffSourcePluginSpy).toHaveBeenLastCalledWith({ viewMode: "source" });

    fireEvent.click(screen.getByRole("button", { name: /Try visual mode again/i }));

    expect(mocked.diffSourcePluginSpy).toHaveBeenLastCalledWith({ viewMode: "rich-text" });
  });

  it("inserts block and text color directives from the custom toolbar dropdowns", () => {
    render(<MarkdownBodyRichEditor value="Initial" onChange={vi.fn()} />);

    fireEvent.click(screen.getByTestId("library-insert-color-block"));
    fireEvent.click(screen.getByTestId("library-insert-text-color"));

    expect(mocked.insertDirectiveSpy).toHaveBeenCalledWith({
      type: "containerDirective",
      name: "grey-block"
    });
    expect(mocked.insertMarkdownSpy).toHaveBeenCalledWith(":grey-text[text]");
  });

  it("assembles the editor toolbar from library controls and custom block actions", () => {
    render(<MarkdownBodyRichEditor value="Initial" onChange={vi.fn()} />);

    expect(mocked.linkDialogPluginSpy).toHaveBeenCalledTimes(1);
    expect(mocked.codeBlockPluginSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultCodeBlockLanguage: "text",
        codeBlockEditorDescriptors: expect.any(Array)
      })
    );
    expect(mocked.codeMirrorPluginSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        codeBlockLanguages: expect.arrayContaining([
          expect.objectContaining({ name: "Python", alias: expect.arrayContaining(["python", "py"]) }),
          expect.objectContaining({ name: "Java", alias: expect.arrayContaining(["java"]) })
        ])
      })
    );
    expect(screen.getByTestId("library-undo-redo")).toBeVisible();
    expect(screen.getByTestId("library-block-type-select")).toHaveAttribute("data-disabled", "false");
    expect(screen.getByTestId("library-bold-italic-toggles")).toBeVisible();
    expect(screen.getByTestId("library-strikethrough-toggles")).toBeVisible();
    expect(screen.getByTestId("library-lists-toggle")).toBeVisible();
    expect(screen.getByTestId("library-create-link")).toBeVisible();
    expect(screen.getByTestId("library-insert-table")).toBeVisible();
    expect(screen.getByTestId("library-inline-code-toggle")).toBeVisible();
    expect(screen.getByTestId("library-insert-code-block")).toBeVisible();
    expect(screen.getByTestId("library-insert-thematic-break")).toBeVisible();
    expect(screen.getByTestId("library-insert-color-block")).toHaveTextContent("Block");
    expect(screen.getByTestId("library-insert-text-color")).toHaveTextContent("Text Color");
    expect(screen.getByTestId("library-diff-source-toggle")).toBeVisible();
  });
});



