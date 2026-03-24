export function prepareMarkdownForDisplay(markdown: string) {
  const normalized = markdown.replace(/\r\n?/g, "\n");
  return normalized
    .split(/(```[\s\S]*?```)/g)
    .map((segment) => (segment.startsWith("```") ? segment : segment.replace(/([^\n])\n(?=[^\n])/g, "$1  \n")))
    .join("");
}

export function stripMarkdownToText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[>#*_~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
