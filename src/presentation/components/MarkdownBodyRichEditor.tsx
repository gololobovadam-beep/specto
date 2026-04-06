import "@mdxeditor/editor/style.css";
import {
  ButtonOrDropdownButton,
  ButtonWithTooltip,
  BoldItalicUnderlineToggles,
  CodeMirrorEditor,
  CodeToggle,
  codeBlockPlugin,
  codeMirrorPlugin,
  CreateLink,
  diffSourcePlugin,
  DiffSourceToggleWrapper,
  directivesPlugin,
  GenericDirectiveEditor,
  headingsPlugin,
  InsertCodeBlock,
  InsertThematicBreak,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  ListsToggle,
  markdownShortcutPlugin,
  MDXEditor,
  NestedLexicalEditor,
  quotePlugin,
  Select,
  StrikeThroughSupSubToggles,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  type CodeBlockEditorDescriptor,
  type CodeBlockEditorProps,
  type DirectiveDescriptor,
  type DirectiveEditorProps,
  type MDXEditorMethods,
  type ViewMode,
  UndoRedo,
  activeEditor$,
  activePlugins$,
  allowedHeadingLevels$,
  convertSelectionToNode$,
  currentBlockType$,
  currentListType$,
  editorInTable$,
  iconComponentFor$,
  insertDirective$,
  insertMarkdown$,
  useCodeBlockEditorContext,
  useTranslation
} from "@mdxeditor/editor";
import { $isListItemNode, $isListNode } from "@lexical/list";
import { useCellValue, useCellValues, usePublisher } from "@mdxeditor/gurx";
import { $createHeadingNode, $createQuoteNode, type HeadingTagType } from "@lexical/rich-text";
import { $createParagraphNode, $createTextNode, $getSelection, $isRangeSelection, type LexicalEditor, type LexicalNode } from "lexical";
import type { ContainerDirective } from "mdast-util-directive";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DropdownMenu } from "./common";
import {
  COLOR_BLOCK_DEFINITIONS,
  isColorBlockDirectiveName,
  isTableAlignmentDirectiveName,
  normalizeColorBlockDirectiveName,
  normalizeEditorInputMarkdown,
  normalizeEditorMarkdown,
  normalizeTableAlignmentDirectiveName,
  TABLE_ALIGNMENT_DEFINITIONS
} from "../utils/markdown";

export interface MarkdownBodyEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface MarkdownParseError {
  error: string;
  source: string;
}

type ToolbarBlockTypeValue = "paragraph" | "quote" | HeadingTagType;

const CODE_BLOCK_LANGUAGES = [
  { value: "text", label: "Plain text", aliases: ["text", "plain", "plaintext"] },
  { value: "ts", label: "TypeScript", aliases: ["ts", "typescript"], extensions: ["ts", "mts", "cts"] },
  { value: "tsx", label: "TSX", aliases: ["tsx"], extensions: ["tsx"] },
  { value: "js", label: "JavaScript", aliases: ["js", "javascript"], extensions: ["js", "mjs", "cjs"] },
  { value: "jsx", label: "JSX", aliases: ["jsx"], extensions: ["jsx"] },
  { value: "json", label: "JSON", aliases: ["json"], extensions: ["json"] },
  { value: "bash", label: "Bash", aliases: ["bash", "sh", "shell"], extensions: ["sh"] },
  { value: "css", label: "CSS", aliases: ["css"], extensions: ["css"] },
  { value: "html", label: "HTML", aliases: ["html"], extensions: ["html", "htm"] },
  { value: "md", label: "Markdown", aliases: ["md", "markdown"], extensions: ["md", "mdx"] },
  { value: "python", label: "Python", aliases: ["python", "py"], extensions: ["py"] },
  { value: "java", label: "Java", aliases: ["java"], extensions: ["java"] }
] as const;

const CODE_MIRROR_LANGUAGES = CODE_BLOCK_LANGUAGES.map(({ label, aliases, extensions }) => ({
  name: label,
  alias: [...aliases],
  extensions: extensions ? [...extensions] : undefined
}));

const CODE_BLOCK_LANGUAGE_ITEMS = CODE_BLOCK_LANGUAGES.map(({ value, label }) => ({
  value,
  label
}));

const COLOR_BLOCK_DIRECTIVE_DESCRIPTOR: DirectiveDescriptor = {
  name: "color-block",
  type: "containerDirective",
  attributes: [],
  hasChildren: true,
  testNode: (node) => node.type === "containerDirective" && isColorBlockDirectiveName(node.name),
  Editor: ColorBlockDirectiveEditor
};

const TABLE_ALIGNMENT_DIRECTIVE_DESCRIPTOR: DirectiveDescriptor = {
  name: "table-alignment",
  type: "containerDirective",
  attributes: [],
  hasChildren: true,
  testNode: (node) => node.type === "containerDirective" && isTableAlignmentDirectiveName(node.name),
  Editor: TableAlignmentDirectiveEditor
};

const DIRECTIVE_DESCRIPTORS: DirectiveDescriptor[] = [
  TABLE_ALIGNMENT_DIRECTIVE_DESCRIPTOR,
  COLOR_BLOCK_DIRECTIVE_DESCRIPTOR,
  createGenericDirectiveDescriptor("textDirective", true),
  createGenericDirectiveDescriptor("leafDirective", false),
  createGenericDirectiveDescriptor("containerDirective", true)
];

const CODE_BLOCK_EDITOR_DESCRIPTORS: CodeBlockEditorDescriptor[] = [
  {
    priority: 0,
    match: () => true,
    Editor: CodeBlockFrameEditor
  }
];

export function MarkdownBodyRichEditor({
  value,
  onChange,
  placeholder = "# Main idea\n\nExplain the topic in a few paragraphs.\n\n- First key point\n- Example or note"
}: MarkdownBodyEditorProps) {
  const editorRef = useRef<MDXEditorMethods | null>(null);
  const normalizedValue = useMemo(() => normalizeEditorInputMarkdown(value), [value]);
  const lastEmittedMarkdownRef = useRef(normalizedValue);
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
            <ToolbarBlockTypeSelect />
            <BoldItalicUnderlineToggles options={["Bold", "Italic"]} />
            <StrikeThroughSupSubToggles options={["Strikethrough"]} />
            <ListsToggle options={["bullet", "number"]} />
            <CreateLink />
            <InsertAlignedTable />
            <CodeToggle />
            <InsertCodeBlock />
            <InsertThematicBreak />
            <InsertColorBlock />
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
      codeBlockPlugin({ defaultCodeBlockLanguage: "text", codeBlockEditorDescriptors: CODE_BLOCK_EDITOR_DESCRIPTORS }),
      codeMirrorPlugin({ codeBlockLanguages: CODE_MIRROR_LANGUAGES }),
      markdownShortcutPlugin(),
      directivesPlugin({
        directiveDescriptors: DIRECTIVE_DESCRIPTORS,
        escapeUnknownTextDirectives: true
      })
    ],
    [preferredViewMode]
  );

  useEffect(() => {
    const isExternalUpdate = normalizedValue !== lastEmittedMarkdownRef.current;
    if (!isExternalUpdate) {
      return;
    }

    setParseError(null);
    lastEmittedMarkdownRef.current = normalizedValue;

    if (preferredViewMode !== "rich-text") {
      setPreferredViewMode("rich-text");
      setEditorInstanceKey((current) => current + 1);
      return;
    }

    editorRef.current?.setMarkdown(normalizedValue);
  }, [normalizedValue, preferredViewMode]);

  function handleChange(nextValue: string) {
    const normalizedNextValue = normalizeEditorMarkdown(nextValue);
    lastEmittedMarkdownRef.current = normalizedNextValue;
    if (parseError) {
      setParseError(null);
    }
    onChange(normalizedNextValue);
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
          markdown={normalizedValue}
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

    </div>
  );
}

function ToolbarBlockTypeSelect() {
  const convertSelectionToNode = usePublisher(convertSelectionToNode$);
  const currentBlockType = useCellValue(currentBlockType$) as string;
  const activeEditor = useCellValue(activeEditor$) as LexicalEditor | null;
  const currentListType = useCellValue(currentListType$) as "" | "bullet" | "check" | "number";
  const [activePlugins, allowedHeadingLevels] = useCellValues(activePlugins$, allowedHeadingLevels$) as [string[], number[]];
  const hasQuote = activePlugins.includes("quote");
  const hasHeadings = activePlugins.includes("headings");
  const t = useTranslation();

  const items = useMemo(() => {
    const nextItems: { label: string; value: ToolbarBlockTypeValue }[] = [
      { label: t("toolbar.blockTypes.paragraph", "Paragraph"), value: "paragraph" }
    ];

    if (hasQuote) {
      nextItems.push({ label: t("toolbar.blockTypes.quote", "Quote"), value: "quote" });
    }

    if (hasHeadings) {
      nextItems.push(
        ...allowedHeadingLevels.map((level) => ({
          label: t("toolbar.blockTypes.heading", "Heading {{level}}", { level }),
          value: `h${level}` as HeadingTagType
        }))
      );
    }

    return nextItems;
  }, [allowedHeadingLevels, hasHeadings, hasQuote, t]);

  if (!hasQuote && !hasHeadings) {
    return null;
  }

  const supportedBlockTypes = new Set(items.map((item) => item.value));
  const isSupportedBlockType = supportedBlockTypes.has(currentBlockType as ToolbarBlockTypeValue);
  const canTransformNumberedListToHeading = !isSupportedBlockType && currentListType === "number";
  const value = (isSupportedBlockType ? currentBlockType : "paragraph") as ToolbarBlockTypeValue;

  return (
    <div className="markdown-editor__block-type-select">
      <Select
        value={value}
        onChange={(blockType) => {
          if (blockType.startsWith("h") && canTransformNumberedListToHeading) {
            convertOrderedListSelectionToHeading(activeEditor, blockType as HeadingTagType);
            return;
          }

          switch (blockType) {
            case "quote":
              convertSelectionToNode(() => $createQuoteNode());
              break;
            case "paragraph":
              convertSelectionToNode(() => $createParagraphNode());
              break;
            default:
              if (blockType.startsWith("h")) {
                convertSelectionToNode(() => $createHeadingNode(blockType as HeadingTagType));
              }
          }
        }}
        triggerTitle={t("toolbar.blockTypeSelect.selectBlockTypeTooltip", "Select block type")}
        placeholder={t("toolbar.blockTypes.paragraph", "Paragraph")}
        disabled={!isSupportedBlockType && !canTransformNumberedListToHeading}
        items={items}
      />
    </div>
  );
}

function InsertAlignedTable() {
  const insertMarkdown = usePublisher(insertMarkdown$);
  const iconComponentFor = useCellValue(iconComponentFor$) as (name: string) => ReactNode;
  const isDisabled = useCellValue(editorInTable$) as boolean;
  const t = useTranslation();

  return (
    <ButtonWithTooltip
      title={t("toolbar.table", "Insert Table")}
      onClick={() => {
        insertMarkdown(":::table-center\n\n|   |   |   |\n| - | - | - |\n|   |   |   |\n|   |   |   |\n\n:::");
      }}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      data-disabled={isDisabled || undefined}
    >
      {iconComponentFor("table")}
    </ButtonWithTooltip>
  );
}

function InsertColorBlock() {
  const insertDirective = usePublisher(insertDirective$);
  const t = useTranslation();
  const items = useMemo(
    () =>
      COLOR_BLOCK_DEFINITIONS.map((definition) => ({
        value: definition.canonicalName,
        label: definition.label.replace(" block", "")
      })),
    []
  );

  return (
    <ButtonOrDropdownButton
      title={t("toolbar.admonition", "Insert block")}
      onChoose={(directiveName) => {
        insertDirective({
          type: "containerDirective",
          name: directiveName
        });
      }}
      items={items}
    >
      Block
    </ButtonOrDropdownButton>
  );
}

function ColorBlockDirectiveEditor({ mdastNode }: DirectiveEditorProps) {
  const colorBlockNode = mdastNode as ContainerDirective;
  const directiveName = normalizeColorBlockDirectiveName(colorBlockNode.name ?? "grey-block");

  return (
    <div className={`markdown-directive markdown-directive--block markdown-directive--${directiveName} markdown-editor__directive-block`}>
      <NestedLexicalEditor
        block
        getContent={(node) => (node as ContainerDirective).children as ContainerDirective["children"]}
        getUpdatedMdastNode={(currentNode, children) => ({
          ...(currentNode as ContainerDirective),
          name: directiveName,
          children: children as ContainerDirective["children"]
        })}
      />
    </div>
  );
}

function TableAlignmentDirectiveEditor({ mdastNode, lexicalNode, parentEditor }: DirectiveEditorProps) {
  const directiveNode = mdastNode as ContainerDirective;
  const directiveName = normalizeTableAlignmentDirectiveName(directiveNode.name ?? "table-center");
  const alignmentItems = TABLE_ALIGNMENT_DEFINITIONS.map((definition) => ({
    id: definition.canonicalName,
    label: definition.label,
    selected: definition.canonicalName === directiveName,
    onSelect: () => handleAlignChange(definition.canonicalName)
  }));

  function handleAlignChange(nextDirectiveName: string) {
    if (nextDirectiveName === directiveName) {
      return;
    }

    parentEditor.update(() => {
      lexicalNode.setMdastNode({
        ...directiveNode,
        name: nextDirectiveName
      });
    });
  }

  return (
    <div
      className={`markdown-editor__table-align-directive markdown-editor__table-align-directive--${directiveName} markdown-directive--${directiveName}`}
    >
      <DropdownMenu
        label="Table alignment"
        triggerVariant="button"
        triggerLabel={<TableAlignmentIcon />}
        className="markdown-editor__table-align-menu"
        preferredPlacement="bottom"
        items={alignmentItems}
      />
      <div className="markdown-editor__table-align-surface">
        <NestedLexicalEditor
          block
          getContent={(node) => (node as ContainerDirective).children as ContainerDirective["children"]}
          getUpdatedMdastNode={(currentNode, children) => ({
            ...(currentNode as ContainerDirective),
            name: normalizeTableAlignmentDirectiveName((currentNode as ContainerDirective).name ?? directiveName),
            children: children as ContainerDirective["children"]
          })}
        />
      </div>
    </div>
  );
}

function CodeBlockFrameEditor(props: CodeBlockEditorProps) {
  const { lexicalNode, parentEditor, setLanguage } = useCodeBlockEditorContext();
  const currentLanguage = normalizeCodeBlockLanguage(props.language);
  const languageItems = useMemo(() => buildCodeBlockLanguageItems(props.language), [props.language]);

  return (
    <div
      className="markdown-editor__code-block"
      onKeyDown={(event) => {
        event.nativeEvent.stopImmediatePropagation();
      }}
    >
      <div className="markdown-editor__code-block-header">
        <div className="markdown-editor__code-language-select">
          <Select
            value={currentLanguage}
            onChange={(nextLanguage) => setLanguage(nextLanguage)}
            triggerTitle="Select code language"
            placeholder="Language"
            items={languageItems}
          />
        </div>
        <button
          type="button"
          className="markdown-editor__code-block-remove"
          onClick={() => {
            parentEditor.update(() => {
              lexicalNode.remove();
            });
          }}
          aria-label="Remove code block"
        >
          <DeleteIcon />
        </button>
      </div>
      <div className="markdown-editor__code-block-editor">
        <CodeMirrorEditor {...props} />
      </div>
    </div>
  );
}

function buildCodeBlockLanguageItems(language?: string | null) {
  const normalizedLanguage = normalizeCodeBlockLanguage(language);
  if (CODE_BLOCK_LANGUAGE_ITEMS.some((item) => item.value === normalizedLanguage)) {
    return CODE_BLOCK_LANGUAGE_ITEMS;
  }

  return [
    ...CODE_BLOCK_LANGUAGE_ITEMS,
    {
      value: normalizedLanguage,
      label: formatCodeBlockLanguageLabel(normalizedLanguage)
    }
  ];
}

function normalizeCodeBlockLanguage(language?: string | null) {
  const normalizedLanguage = language?.trim().toLowerCase();
  if (!normalizedLanguage) {
    return "text";
  }

  const matchedLanguage = CODE_BLOCK_LANGUAGES.find(
    (definition) => definition.value === normalizedLanguage || definition.aliases.includes(normalizedLanguage)
  );

  return matchedLanguage?.value ?? normalizedLanguage;
}

function formatCodeBlockLanguageLabel(language: string) {
  if (language.length <= 3) {
    return language.toUpperCase();
  }

  return `${language.charAt(0).toUpperCase()}${language.slice(1)}`;
}

function TableAlignmentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4.75 6.5A1.75 1.75 0 0 1 6.5 4.75h11A1.75 1.75 0 0 1 19.25 6.5v11a1.75 1.75 0 0 1-1.75 1.75h-11A1.75 1.75 0 0 1 4.75 17.5v-11Zm1.5 0v2.75H17.75V6.5a.25.25 0 0 0-.25-.25h-11a.25.25 0 0 0-.25.25Zm0 4.25v6.75c0 .14.11.25.25.25h11a.25.25 0 0 0 .25-.25v-6.75H6.25Zm2 1.5a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1-.75-.75Zm0 3a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1-.75-.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M9 4.75h6a1 1 0 0 1 .95.68l.22.57h2.58a.75.75 0 0 1 0 1.5h-.92l-.76 10.01A1.75 1.75 0 0 1 15.33 19H8.67a1.75 1.75 0 0 1-1.74-1.49L6.17 7.5h-.92a.75.75 0 0 1 0-1.5h2.58l.22-.57A1 1 0 0 1 9 4.75Zm.29 2.75.69 9.91c.01.06.03.09.05.09h3.94c.02 0 .04-.03.05-.09l.69-9.91H9.29Zm1.46 1.5a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0v-5.5a.75.75 0 0 1 .75-.75Zm3.5 0a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0v-5.5a.75.75 0 0 1 .75-.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function convertOrderedListSelectionToHeading(editor: LexicalEditor | null, blockType: HeadingTagType) {
  if (!editor) {
    return;
  }

  editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      return;
    }

    const nodes = selection.getNodes();
    const selectionNodes = nodes.length > 0 ? nodes : [selection.anchor.getNode(), selection.focus.getNode()];
    const seenListItems = new Set<string>();
    const selectedListItems = selectionNodes.flatMap((node) => {
      let current: LexicalNode | null = node;

      while (current) {
        if ($isListItemNode(current)) {
          if (seenListItems.has(current.getKey())) {
            return [];
          }

          seenListItems.add(current.getKey());
          return [
            {
              item: current,
              value: current.getValue(),
              hasNestedList: current.getChildren().some((child) => $isListNode(child))
            }
          ];
        }

        current = current.getParent();
      }

      return [];
    });

    let lastHeadingNode: LexicalNode | null = null;

    [...selectedListItems].reverse().forEach(({ item, value, hasNestedList }) => {
      const currentItem = item.getLatest();
      if (!$isListItemNode(currentItem) || !$isListNode(currentItem.getParent())) {
        return;
      }

      const headingNode = $createHeadingNode(blockType);
      const numberPrefix = `${value}. `;

      if (hasNestedList) {
        headingNode.append($createTextNode(`${numberPrefix}${currentItem.getTextContent()}`));
        currentItem.replace(headingNode);
      } else {
        headingNode.append($createTextNode(numberPrefix));
        currentItem.replace(headingNode, true);
      }

      lastHeadingNode = headingNode;
    });

    (lastHeadingNode as { selectEnd: () => void } | null)?.selectEnd();
  });

  window.setTimeout(() => {
    editor.focus();
  });
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
