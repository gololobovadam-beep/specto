import { createDefaultPageCardSettings, createDefaultSession, createDefaultSettings } from "./defaults";
import type {
  CategoryEntity,
  PageEntity,
  TabSessionEntry,
  TopicEntity,
  WorkspaceSnapshot
} from "./models";
import { slugify } from "./utils";

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createPageEntity(title = "New Page", sortOrder = 0): PageEntity {
  const timestamp = nowIso();

  return {
    id: createId("page"),
    title,
    slug: slugify(title),
    preferredViewMode: "grid",
    cardSettings: createDefaultPageCardSettings(),
    sortOrder,
    topicIds: [],
    deletedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function normalizePageEntity(page: PageEntity): PageEntity {
  const defaultCardSettings = createDefaultPageCardSettings();
  const rawCardSettings = (page.cardSettings ?? {}) as Partial<PageEntity["cardSettings"]> & {
    previewFontSizePx?: number;
  };
  const legacyPreviewFontSize = rawCardSettings.previewFontSizePx;

  return {
    ...page,
    cardSettings: {
      ...defaultCardSettings,
      ...rawCardSettings,
      titleFontSizePx:
        rawCardSettings.titleFontSizePx ??
        (Number.isFinite(legacyPreviewFontSize)
          ? Math.round((legacyPreviewFontSize ?? defaultCardSettings.titleFontSizePx * 0.8) / 0.8)
          : defaultCardSettings.titleFontSizePx)
    }
  };
}

export function createTopicEntity(
  pageId: string,
  title = "Untitled Topic",
  sortOrder = 0
): TopicEntity {
  const timestamp = nowIso();

  return {
    id: createId("topic"),
    pageId,
    title,
    summary: "",
    bodyMarkdown: "",
    bodyHtml: null,
    bodyFormat: "markdown",
    categoryIds: [],
    sortOrder,
    deletedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function normalizeTopicEntity(topic: TopicEntity): TopicEntity {
  const hasRichTextHtml = typeof topic.bodyHtml === "string" && topic.bodyHtml.trim().length > 0;

  return {
    ...topic,
    summary: topic.summary ?? "",
    bodyMarkdown: topic.bodyMarkdown ?? "",
    bodyHtml: hasRichTextHtml ? topic.bodyHtml ?? null : null,
    bodyFormat: hasRichTextHtml ? "html" : "markdown"
  };
}

export function createCategoryEntity(name: string, sortOrder = 0): CategoryEntity {
  const timestamp = nowIso();

  return {
    id: createId("category"),
    name,
    slug: slugify(name),
    sortOrder,
    isHidden: false,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function createTabEntry(page: PageEntity): TabSessionEntry {
  const timestamp = nowIso();

  return {
    id: page.id,
    pageId: page.id,
    label: page.title,
    openedAt: timestamp,
    lastVisitedAt: timestamp
  };
}

export function createDefaultWorkspaceSnapshot(): WorkspaceSnapshot {
  return {
    pages: [],
    topics: [],
    categories: [
      createCategoryEntity("Functions", 0),
      createCategoryEntity("OOP", 1),
      createCategoryEntity("Decorators", 2),
      createCategoryEntity("SQLAlchemy", 3)
    ],
    session: createDefaultSession(),
    settings: createDefaultSettings()
  };
}
