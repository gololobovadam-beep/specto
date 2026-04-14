import { describe, expect, it, vi } from "vitest";
import { WorkspaceService } from "./WorkspaceService";
import { createDefaultSession, createDefaultSettings } from "../domain/defaults";
import type {
  AppSession,
  CategoryEntity,
  PageEntity,
  TopicEntity,
  UserSettings,
  WorkspaceSnapshot
} from "../domain/models";
import type { RepositorySet } from "../domain/repositories";

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createPage(overrides: Partial<PageEntity> = {}): PageEntity {
  return {
    id: "page-1",
    title: "Python",
    slug: "python",
    preferredViewMode: "grid",
    cardSettings: {
      minWidthPx: 240,
      titleFontSizePx: 18,
      titleLines: 4,
      showPreviewContent: true,
      previewLines: 3
    },
    sortOrder: 0,
    topicIds: ["topic-1"],
    deletedAt: null,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...overrides
  };
}

function createTopic(overrides: Partial<TopicEntity> = {}): TopicEntity {
  return {
    id: "topic-1",
    pageId: "page-1",
    title: "Decorators",
    summary: "About decorators",
    bodyMarkdown: "## Decorators",
    categoryIds: ["category-1"],
    sortOrder: 0,
    deletedAt: null,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...overrides
  };
}

function createCategory(overrides: Partial<CategoryEntity> = {}): CategoryEntity {
  return {
    id: "category-1",
    name: "Functions",
    slug: "functions",
    sortOrder: 0,
    isHidden: false,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...overrides
  };
}

function createSnapshot(overrides: Partial<WorkspaceSnapshot> = {}): WorkspaceSnapshot {
  const page = createPage();
  const topic = createTopic();
  const session: AppSession = {
    ...createDefaultSession(),
    openTabs: [
      {
        id: page.id,
        pageId: page.id,
        label: page.title,
        openedAt: "2026-04-01T00:00:00.000Z",
        lastVisitedAt: "2026-04-01T00:00:00.000Z"
      }
    ],
    activeTabId: page.id,
    lastOpenedHub: false
  };
  const settings: UserSettings = createDefaultSettings();

  return {
    pages: [page],
    topics: [topic],
    categories: [createCategory()],
    session,
    settings,
    ...overrides
  };
}

function createRepositories(snapshot: WorkspaceSnapshot) {
  const pagesSave = vi.fn(async () => undefined);
  const pagesSaveMany = vi.fn(async () => undefined);
  const topicsSave = vi.fn(async () => undefined);
  const topicsSaveMany = vi.fn(async () => undefined);
  const categoriesSave = vi.fn(async () => undefined);
  const categoriesSaveMany = vi.fn(async () => undefined);
  const categoriesDelete = vi.fn(async () => undefined);
  const sessionSave = vi.fn(async () => undefined);
  const settingsSave = vi.fn(async () => undefined);

  const repositories: RepositorySet = {
    kind: "local",
    pages: {
      list: vi.fn(async () => cloneValue(snapshot.pages)),
      save: pagesSave,
      saveMany: pagesSaveMany
    },
    topics: {
      list: vi.fn(async () => cloneValue(snapshot.topics)),
      save: topicsSave,
      saveMany: topicsSaveMany
    },
    categories: {
      list: vi.fn(async () => cloneValue(snapshot.categories)),
      save: categoriesSave,
      saveMany: categoriesSaveMany,
      delete: categoriesDelete
    },
    session: {
      get: vi.fn(async () => cloneValue(snapshot.session)),
      save: sessionSave
    },
    settings: {
      get: vi.fn(async () => cloneValue(snapshot.settings)),
      save: settingsSave
    }
  };

  return {
    repositories,
    spies: {
      pagesSave,
      pagesSaveMany,
      topicsSave,
      topicsSaveMany,
      categoriesSave,
      categoriesSaveMany,
      categoriesDelete,
      sessionSave,
      settingsSave
    }
  };
}

describe("WorkspaceService", () => {
  it("skips page writes when the view mode is already current", async () => {
    const snapshot = createSnapshot();
    const { repositories, spies } = createRepositories(snapshot);
    const service = new WorkspaceService(repositories);

    const result = await service.setPageViewMode(snapshot.pages[0].id, "grid");

    expect(spies.pagesSave).not.toHaveBeenCalled();
    expect(result.pages[0].preferredViewMode).toBe("grid");
  });

  it("skips topic writes when the editor payload does not change the topic", async () => {
    const snapshot = createSnapshot();
    const { repositories, spies } = createRepositories(snapshot);
    const service = new WorkspaceService(repositories);

    const result = await service.updateTopic(snapshot.topics[0].id, {
      title: snapshot.topics[0].title,
      summary: snapshot.topics[0].summary,
      bodyMarkdown: snapshot.topics[0].bodyMarkdown,
      categoryIds: [...snapshot.topics[0].categoryIds]
    });

    expect(spies.topicsSave).not.toHaveBeenCalled();
    expect(result.topics[0].title).toBe(snapshot.topics[0].title);
  });

  it("skips session writes when the page query is unchanged", async () => {
    const snapshot = createSnapshot({
      session: {
        ...createSnapshot().session,
        pageUiStateByPageId: {
          "page-1": { searchQuery: "decorator" }
        }
      }
    });
    const { repositories, spies } = createRepositories(snapshot);
    const service = new WorkspaceService(repositories);

    const result = await service.savePageQuery("page-1", "decorator");

    expect(spies.sessionSave).not.toHaveBeenCalled();
    expect(result.session.pageUiStateByPageId["page-1"]?.searchQuery).toBe("decorator");
  });
});
