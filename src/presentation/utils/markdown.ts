import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";

export interface SelectionEditResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export type TextTransformer = (
  value: string,
  selectionStart: number,
  selectionEnd: number
) => SelectionEditResult;

export interface ToolbarAction {
  key: string;
  label: string;
  title: string;
  onApply: TextTransformer;
}

interface MarkdownAstNode {
  type: string;
  name?: string;
  attributes?: Record<string, unknown> | null;
  data?: Record<string, unknown>;
  children?: MarkdownAstNode[];
}

export const MARKDOWN_TOOLBAR_ACTIONS: ToolbarAction[] = [
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

export const MARKDOWN_REMARK_PLUGINS = [remarkGfm, remarkDirective, remarkDirectivePreset];

export function prepareMarkdownForDisplay(markdown: string) {
  const normalized = normalizeMarkdownLineEndings(markdown);
  return normalized
    .split(/(```[\s\S]*?```)/g)
    .map((segment) => (segment.startsWith("```") ? segment : segment.replace(/([^\n])\n(?=[^\n])/g, "$1  \n")))
    .join("");
}

export function stripMarkdownToText(markdown: string) {
  return normalizeMarkdownLineEndings(markdown)
    .replace(/^:::\s*$/gm, " ")
    .replace(/^:::+[a-z0-9-]+(?:\[[^\]]*])?(?:\{[^}]*})?[ \t]*$/gim, " ")
    .replace(/^::[a-z0-9-]+\[([^\]]+)\](?:\{[^}]*})?[ \t]*$/gim, "$1")
    .replace(/^::[a-z0-9-]+(?:\{[^}]*})?[ \t]*$/gim, " ")
    .replace(/:([a-z0-9-]+)\[([^\]]+)\](?:\{[^}]*})?/gi, "$2")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[>#*_~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function wrapSelection(
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
    selectionStart: contentStart,
    selectionEnd: contentEnd
  };
}

export function wrapCodeBlock(value: string, selectionStart: number, selectionEnd: number): SelectionEditResult {
  const selectedText = value.slice(selectionStart, selectionEnd);
  const content = selectedText || "\n";
  const blockPrefix = "```\n";
  const blockSuffix = "\n```";
  const nextValue = `${value.slice(0, selectionStart)}${blockPrefix}${content}${blockSuffix}${value.slice(selectionEnd)}`;
  const cursorStart = selectionStart + blockPrefix.length;
  const cursorEnd = cursorStart + content.length;

  return {
    value: nextValue,
    selectionStart: cursorStart,
    selectionEnd: selectedText ? cursorEnd : cursorStart
  };
}

export function insertSnippet(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  snippet: string,
  cursorOffset: number
): SelectionEditResult {
  const nextValue = `${value.slice(0, selectionStart)}${snippet}${value.slice(selectionEnd)}`;
  const nextCursor = selectionStart + cursorOffset;

  return {
    value: nextValue,
    selectionStart: nextCursor,
    selectionEnd: nextCursor
  };
}

export function prefixSelectedLines(
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

export function indentSelection(value: string, selectionStart: number, selectionEnd: number): SelectionEditResult {
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

export function unindentSelection(value: string, selectionStart: number, selectionEnd: number): SelectionEditResult {
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

function normalizeMarkdownLineEndings(markdown: string) {
  return markdown.replace(/\r\n?/g, "\n");
}

function remarkDirectivePreset() {
  return function (tree: MarkdownAstNode) {
    visitMarkdownAst(tree, (node) => {
      if (!isDirectiveNode(node) || !node.name) {
        return;
      }

      const directiveName = normalizeDirectiveName(node.name);
      const attributes = node.attributes ?? {};
      const classNames = mergeDirectiveClassNames(
        "markdown-directive",
        node.type === "textDirective" ? "markdown-directive--inline" : "markdown-directive--block",
        `markdown-directive--${directiveName}`,
        attributes.class,
        attributes.className
      );
      const { class: _class, className: _className, ...restAttributes } = attributes;
      const data = (node.data ??= {});

      data.hName = node.type === "textDirective" ? "span" : "div";
      data.hProperties = {
        ...restAttributes,
        className: classNames
      };
    });
  };
}

function visitMarkdownAst(node: MarkdownAstNode, onVisit: (node: MarkdownAstNode) => void) {
  onVisit(node);

  if (!Array.isArray(node.children)) {
    return;
  }

  node.children.forEach((child) => visitMarkdownAst(child, onVisit));
}

function isDirectiveNode(node: MarkdownAstNode) {
  return (
    node.type === "containerDirective" ||
    node.type === "leafDirective" ||
    node.type === "textDirective"
  );
}

function normalizeDirectiveName(name: string) {
  return (
    name
      .trim()
      .toLocaleLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "custom"
  );
}

function mergeDirectiveClassNames(...values: unknown[]) {
  return values.flatMap((value) => normalizeClassName(value)).filter(Boolean);
}

function normalizeClassName(value: unknown): string[] {
  if (typeof value === "string") {
    return value.split(/\s+/).filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeClassName(item));
  }

  return [];
}
