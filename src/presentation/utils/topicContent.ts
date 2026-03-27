import DOMPurify from "dompurify";
import { marked } from "marked";
import type { TopicEntity } from "../../domain/models";
import { prepareMarkdownForDisplay, stripMarkdownToText } from "./markdown";

marked.setOptions({
  gfm: true,
  breaks: true
});

export function getTopicBodyEditorHtml(topic: Pick<TopicEntity, "bodyHtml" | "bodyMarkdown">) {
  if (hasRichTextContent(topic.bodyHtml)) {
    return sanitizeRichTextHtml(topic.bodyHtml ?? "");
  }

  return convertMarkdownToRichTextHtml(topic.bodyMarkdown);
}

export function getTopicBodyDisplayHtml(topic: Pick<TopicEntity, "bodyHtml" | "bodyFormat">) {
  return topic.bodyFormat === "html" && hasRichTextContent(topic.bodyHtml)
    ? sanitizeRichTextHtml(topic.bodyHtml ?? "")
    : null;
}

export function getTopicBodyPlainText(topic: Pick<TopicEntity, "bodyHtml" | "bodyFormat" | "bodyMarkdown">) {
  const richTextHtml = getTopicBodyDisplayHtml(topic);
  if (richTextHtml) {
    return extractTextFromHtml(richTextHtml);
  }

  return stripMarkdownToText(topic.bodyMarkdown);
}

export function sanitizeRichTextHtml(html: string) {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true }
  }).trim();
}

export function convertMarkdownToRichTextHtml(markdown: string) {
  if (!markdown.trim()) {
    return "";
  }

  const rendered = marked.parse(prepareMarkdownForDisplay(markdown)) as string;
  return sanitizeRichTextHtml(rendered);
}

function hasRichTextContent(html: string | null | undefined) {
  return typeof html === "string" && html.trim().length > 0;
}

function extractTextFromHtml(html: string) {
  if (typeof DOMParser !== "undefined") {
    const documentFragment = new DOMParser().parseFromString(html, "text/html");
    return documentFragment.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
  }

  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
