import {
  createCategoryEntity,
  createDefaultWorkspaceSnapshot,
  createPageEntity,
  createTabEntry,
  createTopicEntity,
  normalizePageEntity
} from "../domain/factories";
import { normalizeUserSettings } from "../domain/defaults";
import type {
  CategoryEntity,
  PageCardSettings,
  PageEntity,
  TopicEntity,
  UserSettings,
  ViewMode,
  WorkspaceSnapshot
} from "../domain/models";
import type { RepositorySet } from "../domain/repositories";
import { slugify, sortByOrder } from "../domain/utils";

interface TopicInput {
  title: string;
  summary: string;
  bodyMarkdown: string;
  categoryIds: string[];
}

export class WorkspaceService {
  constructor(private readonly repositories: RepositorySet) {}

  async loadWorkspace(): Promise<WorkspaceSnapshot> {
    const [pages, topics, categories, session, settings] = await Promise.all([
      this.repositories.pages.list(),
      this.repositories.topics.list(),
      this.repositories.categories.list(),
      this.repositories.session.get(),
      this.repositories.settings.get()
    ]);

    const snapshot =
      pages.length === 0 &&
      topics.length === 0 &&
      categories.length === 0 &&
      session.openTabs.length === 0
        ? createDefaultWorkspaceSnapshot()
        : { pages, topics, categories, session, settings };

    if (pages.length === 0 && topics.length === 0 && categories.length === 0) {
      await Promise.all([
        this.repositories.categories.saveMany(snapshot.categories),
        this.repositories.session.save(snapshot.session),
        this.repositories.settings.save(snapshot.settings)
      ]);
    }

    return this.normalizeSnapshot(snapshot);
  }

  async createPage(title = "New Page"): Promise<WorkspaceSnapshot> {
    const snapshot = await this.loadWorkspace();
    const page = createPageEntity(title, snapshot.pages.length);
    snapshot.pages.push(page);
    snapshot.session.openTabs.push(createTabEntry(page));
    snapshot.session.activeTabId = page.id;
    snapshot.session.lastOpenedHub = false;

    await Promise.all([
      this.repositories.pages.save(page),
      this.repositories.session.save(snapshot.session)
    ]);

    return this.normalizeSnapshot(snapshot);
  }

  async renamePage(pageId: string, title: string): Promise<WorkspaceSnapshot> {
    const snapshot = await this.loadWorkspace();
    const page = this.mustFindPage(snapshot.pages, pageId);
    const trimmedTitle = title.trim() || page.title;
    const nextOpenTabs = snapshot.session.openTabs.map((tab) =>
      tab.pageId === pageId ? { ...tab, label: trimmedTitle } : tab
    );

    if (trimmedTitle === page.title && this.areTabCollectionsEqual(snapshot.session.openTabs, nextOpenTabs)) {
      return this.normalizeSnapshot(snapshot);
    }

    page.title = trimmedTitle;
    page.slug = slugify(trimmedTitle);
    page.updatedAt = new Date().toISOString();
    snapshot.session.openTabs = nextOpenTabs;

    await Promise.all([
      this.repositories.pages.save(page),
      this.repositories.session.save(snapshot.session)
    ]);

    return this.normalizeSnapshot(snapshot);
  }

  async softDeletePage(pageId: string): Promise<WorkspaceSnapshot> {
    const snapshot = await this.loadWorkspace();
    const page = this.mustFindPage(snapshot.pages, pageId);
    const deletedAt = new Date().toISOString();
    page.deletedAt = deletedAt;
    page.updatedAt = deletedAt;

    snapshot.topics = snapshot.topics.map((topic) =>
      topic.pageId === pageId ? { ...topic, deletedAt, updatedAt: deletedAt } : topic
    );
    snapshot.session.openTabs = snapshot.session.openTabs.filter((tab) => tab.pageId !== pageId);
    snapshot.session.activeTabId = snapshot.session.openTabs.at(-1)?.pageId ?? null;
    snapshot.session.lastOpenedHub = snapshot.session.openTabs.length === 0;

    await Promise.all([
      this.repositories.pages.save(page),
      this.repositories.topics.saveMany(snapshot.topics),
      this.repositories.session.save(snapshot.session)
    ]);

    return this.normalizeSnapshot(snapshot);
  }

  async reorderPages(pageIds: string[]): Promise<WorkspaceSnapshot> {
    const snapshot = await this.loadWorkspace();
    const visiblePages = sortByOrder(snapshot.pages.filter((page) => !page.deletedAt));
    const hiddenPages = snapshot.pages.filter((page) => page.deletedAt);

    if (visiblePages.length === pageIds.length && visiblePages.every((page, index) => page.id === pageIds[index])) {
      return this.normalizeSnapshot(snapshot);
    }

    const pageMap = new Map(visiblePages.map((page) => [page.id, page]));

    const reordered = pageIds
      .map((pageId, index) => {
        const page = pageMap.get(pageId);
        return page ? { ...page, sortOrder: index, updatedAt: new Date().toISOString() } : null;
      })
      .filter((page): page is PageEntity => Boolean(page));

    snapshot.pages = [...reordered, ...hiddenPages];
    await this.repositories.pages.saveMany(snapshot.pages);
    return this.normalizeSnapshot(snapshot);
  }

  async setPageViewMode(pageId: string, mode: ViewMode): Promise<WorkspaceSnapshot> {
    const snapshot = await this.loadWorkspace();
    const page = this.mustFindPage(snapshot.pages, pageId);
    if (page.preferredViewMode === mode) {
      return this.normalizeSnapshot(snapshot);
    }

    page.preferredViewMode = mode;
    page.updatedAt = new Date().toISOString();
    await this.repositories.pages.save(page);
    return this.normalizeSnapshot(snapshot);
  }

  async updatePageCardSettings(
    pageId: string,
    patch: Partial<PageCardSettings>
  ): Promise<WorkspaceSnapshot> {
    const snapshot = await this.loadWorkspace();
    const page = this.mustFindPage(snapshot.pages, pageId);
    const nextCardSettings = this.sanitizePageCardSettings({
      ...page.cardSettings,
      ...patch
    });

    if (this.arePageCardSettingsEqual(page.cardSettings, nextCardSettings)) {
      return this.normalizeSnapshot(snapshot);
    }

    page.cardSettings = nextCardSettings;
    page.updatedAt = new Date().toISOString();
    await this.repositories.pages.save(page);
    return this.normalizeSnapshot(snapshot);
  }

  async openPageTab(pageId: string): Promise<WorkspaceSnapshot> {
    const snapshot = await this.loadWorkspace();
    const page = this.mustFindPage(snapshot.pages, pageId);
    const existingTab = snapshot.session.openTabs.find((tab) => tab.pageId === pageId);
    const shouldUpdateVisit =
      !existingTab || snapshot.session.activeTabId !== pageId || snapshot.session.lastOpenedHub;

    if (!existingTab) {
      snapshot.session.openTabs.push(createTabEntry(page));
    }

    if (!shouldUpdateVisit) {
      return this.normalizeSnapshot(snapshot);
    }

    snapshot.session.activeTabId = pageId;
    snapshot.session.lastOpenedHub = false;
    snapshot.session.openTabs = snapshot.session.openTabs.map((tab) =>
      tab.pageId === pageId
        ? { ...tab, label: page.title, lastVisitedAt: new Date().toISOString() }
        : tab
    );

    await this.repositories.session.save(snapshot.session);
    return this.normalizeSnapshot(snapshot);
  }

  async closeTab(pageId: string): Promise<WorkspaceSnapshot> {
    const snapshot = await this.loadWorkspace();
    if (!snapshot.session.openTabs.some((tab) => tab.pageId === pageId)) {
      return this.normalizeSnapshot(snapshot);
    }

    snapshot.session.openTabs = snapshot.session.openTabs.filter((tab) => tab.pageId !== pageId);

    if (snapshot.session.activeTabId === pageId) {
      snapshot.session.activeTabId = snapshot.session.openTabs.at(-1)?.pageId ?? null;
    }

    snapshot.session.lastOpenedHub = snapshot.session.openTabs.length === 0;

    await this.repositories.session.save(snapshot.session);
    return this.normalizeSnapshot(snapshot);
  }

  async showPagesHub(): Promise<WorkspaceSnapshot> {
    const snapshot = await this.loadWorkspace();
    if (snapshot.session.lastOpenedHub && snapshot.session.activeTabId === null) {
      return this.normalizeSnapshot(snapshot);
    }

    snapshot.session.lastOpenedHub = true;
    snapshot.session.activeTabId = null;
    await this.repositories.session.save(snapshot.session);
    return this.normalizeSnapshot(snapshot);
  }

  async setActiveTab(pageId: string | null): Promise<WorkspaceSnapshot> {
    const snapshot = await this.loadWorkspace();
    if (snapshot.session.activeTabId === pageId && snapshot.session.lastOpenedHub === (pageId === null)) {
      return this.normalizeSnapshot(snapshot);
    }

    snapshot.session.activeTabId = pageId;
    snapshot.session.lastOpenedHub = pageId === null;
    await this.repositories.session.save(snapshot.session);
    return this.normalizeSnapshot(snapshot);
  }

  async savePageQuery(pageId: string, searchQuery: string): Promise<WorkspaceSnapshot> {
    const snapshot = await this.loadWorkspace();
    const currentQuery = snapshot.session.pageUiStateByPageId[pageId]?.searchQuery ?? "";
    if (currentQuery === searchQuery) {
      return this.normalizeSnapshot(snapshot);
    }

    snapshot.session.pageUiStateByPageId[pageId] = { searchQuery };
    await this.repositories.session.save(snapshot.session);
    return this.normalizeSnapshot(snapshot);
  }

  async createTopic(pageId: string, title = "Untitled Topic"): Promise<WorkspaceSnapshot> {
    const snapshot = await this.loadWorkspace();
    const page = this.mustFindPage(snapshot.pages, pageId);
    const topic = createTopicEntity(
      pageId,
      title,
      snapshot.topics.filter((item) => item.pageId === pageId && !item.deletedAt).length
    );
    snapshot.topics.push(topic);
    page.topicIds.push(topic.id);
    page.updatedAt = new Date().toISOString();

    await Promise.all([
      this.repositories.topics.save(topic),
      this.repositories.pages.save(page)
    ]);

    return this.normalizeSnapshot(snapshot);
  }

  async updateTopic(topicId: string, input: TopicInput): Promise<WorkspaceSnapshot> {
    const snapshot = await this.loadWorkspace();
    const topic = this.mustFindTopic(snapshot.topics, topicId);
    const validCategoryIds = new Set(snapshot.categories.map((category) => category.id));
    const nextTitle = input.title.trim() || topic.title;
    const nextSummary = input.summary.trim();
    const nextBodyMarkdown = input.bodyMarkdown;
    const nextCategoryIds = input.categoryIds.filter((categoryId) => validCategoryIds.has(categoryId));

    if (
      topic.title === nextTitle &&
      topic.summary === nextSummary &&
      topic.bodyMarkdown === nextBodyMarkdown &&
      this.areStringArraysEqual(topic.categoryIds, nextCategoryIds)
    ) {
      return this.normalizeSnapshot(snapshot);
    }

    topic.title = nextTitle;
    topic.summary = nextSummary;
    topic.bodyMarkdown = nextBodyMarkdown;
    topic.categoryIds = nextCategoryIds;
    topic.updatedAt = new Date().toISOString();

    await this.repositories.topics.save(topic);
    return this.normalizeSnapshot(snapshot);
  }

  async duplicateTopic(topicId: string): Promise<WorkspaceSnapshot> {
    const snapshot = await this.loadWorkspace();
    const topic = this.mustFindTopic(snapshot.topics, topicId);
    const topicsInPage = sortByOrder(snapshot.topics.filter((item) => item.pageId === topic.pageId && !item.deletedAt));
    const duplicate = createTopicEntity(topic.pageId, `${topic.title} Copy`, topicsInPage.length);
    duplicate.summary = topic.summary;
    duplicate.bodyMarkdown = topic.bodyMarkdown;
    duplicate.categoryIds = [...topic.categoryIds];

    snapshot.topics.push(duplicate);
    const page = this.mustFindPage(snapshot.pages, topic.pageId);
    page.topicIds.push(duplicate.id);
    page.updatedAt = new Date().toISOString();

    await Promise.all([
      this.repositories.topics.save(duplicate),
      this.repositories.pages.save(page)
    ]);

    return this.normalizeSnapshot(snapshot);
  }

  async softDeleteTopic(topicId: string): Promise<WorkspaceSnapshot> {
    const snapshot = await this.loadWorkspace();
    const topic = this.mustFindTopic(snapshot.topics, topicId);
    const deletedAt = new Date().toISOString();
    topic.deletedAt = deletedAt;
    topic.updatedAt = deletedAt;

    await this.repositories.topics.save(topic);
    return this.normalizeSnapshot(snapshot);
  }

  async reorderTopics(pageId: string, topicIds: string[]): Promise<WorkspaceSnapshot> {
    const snapshot = await this.loadWorkspace();
    const pageTopics = snapshot.topics.filter((topic) => topic.pageId === pageId && !topic.deletedAt);
    const hiddenTopics = snapshot.topics.filter((topic) => topic.pageId !== pageId || topic.deletedAt);

    if (pageTopics.length === topicIds.length && pageTopics.every((topic, index) => topic.id === topicIds[index])) {
      return this.normalizeSnapshot(snapshot);
    }

    const topicMap = new Map(pageTopics.map((topic) => [topic.id, topic]));

    const reordered = topicIds
      .map((topicId, index) => {
        const topic = topicMap.get(topicId);
        return topic ? { ...topic, sortOrder: index, updatedAt: new Date().toISOString() } : null;
      })
      .filter((topic): topic is TopicEntity => Boolean(topic));

    snapshot.topics = [...hiddenTopics, ...reordered];
    await this.repositories.topics.saveMany(snapshot.topics);
    return this.normalizeSnapshot(snapshot);
  }

  async createCategory(name: string): Promise<WorkspaceSnapshot> {
    const snapshot = await this.loadWorkspace();
    const trimmedName = name.trim();
    if (!trimmedName) {
      return this.normalizeSnapshot(snapshot);
    }

    const category = createCategoryEntity(trimmedName, snapshot.categories.length);
    snapshot.categories.push(category);
    await this.repositories.categories.save(category);
    return this.normalizeSnapshot(snapshot);
  }

  async renameCategory(categoryId: string, name: string): Promise<WorkspaceSnapshot> {
    const snapshot = await this.loadWorkspace();
    const category = snapshot.categories.find((item) => item.id === categoryId);
    if (!category) {
      return this.normalizeSnapshot(snapshot);
    }

    const trimmedName = name.trim() || category.name;
    if (trimmedName === category.name) {
      return this.normalizeSnapshot(snapshot);
    }

    category.name = trimmedName;
    category.slug = slugify(trimmedName);
    category.updatedAt = new Date().toISOString();
    await this.repositories.categories.save(category);
    return this.normalizeSnapshot(snapshot);
  }

  async hideCategory(categoryId: string): Promise<WorkspaceSnapshot> {
    return this.setCategoryVisibility(categoryId, true);
  }

  async showCategory(categoryId: string): Promise<WorkspaceSnapshot> {
    return this.setCategoryVisibility(categoryId, false);
  }

  async deleteCategory(categoryId: string): Promise<WorkspaceSnapshot> {
    const snapshot = await this.loadWorkspace();
    const category = snapshot.categories.find((item) => item.id === categoryId);
    if (!category) {
      return this.normalizeSnapshot(snapshot);
    }

    snapshot.categories = snapshot.categories.filter((item) => item.id !== categoryId);
    snapshot.topics = snapshot.topics.map((topic) =>
      topic.categoryIds.includes(categoryId)
        ? {
            ...topic,
            categoryIds: topic.categoryIds.filter((id) => id !== categoryId),
            updatedAt: new Date().toISOString()
          }
        : topic
    );

    await Promise.all([
      this.repositories.categories.delete(categoryId),
      this.repositories.topics.saveMany(snapshot.topics)
    ]);

    return this.normalizeSnapshot(snapshot);
  }

  async importWorkspace(sourceSnapshot: WorkspaceSnapshot): Promise<WorkspaceSnapshot> {
    const snapshot = this.normalizeSnapshot(sourceSnapshot);

    await Promise.all([
      this.repositories.pages.saveMany(snapshot.pages),
      this.repositories.topics.saveMany(snapshot.topics),
      this.repositories.categories.saveMany(snapshot.categories),
      this.repositories.session.save(snapshot.session),
      this.repositories.settings.save(snapshot.settings)
    ]);

    return this.normalizeSnapshot(snapshot);
  }

  async updateSettings(patch: Partial<UserSettings>): Promise<WorkspaceSnapshot> {
    const snapshot = await this.loadWorkspace();
    const nextSettings = { ...snapshot.settings, ...patch };
    if (this.areUserSettingsEqual(snapshot.settings, nextSettings)) {
      return this.normalizeSnapshot(snapshot);
    }

    snapshot.settings = nextSettings;
    await this.repositories.settings.save(snapshot.settings);
    return this.normalizeSnapshot(snapshot);
  }

  private normalizeSnapshot(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
    const pages = sortByOrder(snapshot.pages.map((page) => normalizePageEntity(page)));

    return {
      ...snapshot,
      pages,
      topics: sortByOrder(snapshot.topics),
      categories: sortByOrder(snapshot.categories),
      settings: normalizeUserSettings(snapshot.settings),
      session: {
        ...snapshot.session,
        openTabs: snapshot.session.openTabs.filter((tab) => pages.some((page) => page.id === tab.pageId && !page.deletedAt))
      }
    };
  }

  private sanitizePageCardSettings(settings: PageCardSettings): PageCardSettings {
    return {
      minWidthPx: this.clampNumber(settings.minWidthPx, 70, 480),
      titleFontSizePx: this.clampNumber(settings.titleFontSizePx, 6, 30),
      titleLines: this.clampNumber(settings.titleLines, 1, 12),
      showPreviewContent: Boolean(settings.showPreviewContent),
      previewLines: this.clampNumber(settings.previewLines, 1, 12)
    };
  }

  private clampNumber(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) {
      return min;
    }

    return Math.min(max, Math.max(min, Math.round(value)));
  }

  private mustFindPage(pages: PageEntity[], pageId: string) {
    const page = pages.find((item) => item.id === pageId && !item.deletedAt);
    if (!page) {
      throw new Error(`Page not found: ${pageId}`);
    }

    return page;
  }

  private mustFindTopic(topics: TopicEntity[], topicId: string) {
    const topic = topics.find((item) => item.id === topicId && !item.deletedAt);
    if (!topic) {
      throw new Error(`Topic not found: ${topicId}`);
    }

    return topic;
  }

  private async setCategoryVisibility(categoryId: string, isHidden: boolean): Promise<WorkspaceSnapshot> {
    const snapshot = await this.loadWorkspace();
    const category = snapshot.categories.find((item) => item.id === categoryId);
    if (!category) {
      return this.normalizeSnapshot(snapshot);
    }

    if (category.isHidden === isHidden) {
      return this.normalizeSnapshot(snapshot);
    }

    category.isHidden = isHidden;
    category.updatedAt = new Date().toISOString();
    await this.repositories.categories.save(category);
    return this.normalizeSnapshot(snapshot);
  }

  private arePageCardSettingsEqual(left: PageCardSettings, right: PageCardSettings) {
    return (
      left.minWidthPx === right.minWidthPx &&
      left.titleFontSizePx === right.titleFontSizePx &&
      left.titleLines === right.titleLines &&
      left.showPreviewContent === right.showPreviewContent &&
      left.previewLines === right.previewLines
    );
  }

  private areUserSettingsEqual(left: UserSettings, right: UserSettings) {
    return (
      left.darkTheme === right.darkTheme &&
      left.compactDensity === right.compactDensity &&
      left.reducedMotion === right.reducedMotion &&
      left.showTopicCounters === right.showTopicCounters &&
      left.futureCloudSyncEnabled === right.futureCloudSyncEnabled &&
      left.futureImportEnabled === right.futureImportEnabled
    );
  }

  private areStringArraysEqual(left: string[], right: string[]) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }

  private areTabCollectionsEqual(
    left: WorkspaceSnapshot["session"]["openTabs"],
    right: WorkspaceSnapshot["session"]["openTabs"]
  ) {
    return (
      left.length === right.length &&
      left.every((tab, index) => {
        const next = right[index];
        return (
          tab.id === next?.id &&
          tab.pageId === next.pageId &&
          tab.label === next.label &&
          tab.openedAt === next.openedAt &&
          tab.lastVisitedAt === next.lastVisitedAt
        );
      })
    );
  }
}
