export type ViewMode = "grid" | "list";

export interface PageCardSettings {
  minWidthPx: number;
  titleFontSizePx: number;
  showPreviewContent: boolean;
  previewLines: number;
}

export interface PageEntity {
  id: string;
  title: string;
  slug: string;
  preferredViewMode: ViewMode;
  cardSettings: PageCardSettings;
  sortOrder: number;
  topicIds: string[];
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TopicEntity {
  id: string;
  pageId: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
  categoryIds: string[];
  sortOrder: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryEntity {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TabSessionEntry {
  id: string;
  pageId: string;
  label: string;
  openedAt: string;
  lastVisitedAt: string;
}

export interface PageUiState {
  searchQuery: string;
}

export interface AppSession {
  openTabs: TabSessionEntry[];
  activeTabId: string | null;
  lastOpenedHub: boolean;
  pageUiStateByPageId: Record<string, PageUiState>;
  schemaVersion: number;
}

export interface UserSettings {
  compactDensity: boolean;
  reducedMotion: boolean;
  showTopicCounters: boolean;
  futureCloudSyncEnabled: boolean;
  futureImportEnabled: boolean;
}

export interface WorkspaceSnapshot {
  pages: PageEntity[];
  topics: TopicEntity[];
  categories: CategoryEntity[];
  session: AppSession;
  settings: UserSettings;
}
