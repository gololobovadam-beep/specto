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

function getCryptoApi() {
  return typeof globalThis === "object" ? globalThis.crypto : undefined;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function generateUuid() {
  const cryptoApi = getCryptoApi();
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  if (cryptoApi?.getRandomValues) {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytesToHex(bytes);
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 14)}`;
}

function createId(prefix: string) {
  return `${prefix}-${generateUuid()}`;
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
    categoryIds: [],
    sortOrder,
    deletedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp
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
