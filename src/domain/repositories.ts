import type {
  AppSession,
  CategoryEntity,
  PageEntity,
  TopicEntity,
  UserSettings
} from "./models";

export interface PageRepository {
  list(): Promise<PageEntity[]>;
  save(page: PageEntity): Promise<void>;
  saveMany(pages: PageEntity[]): Promise<void>;
}

export interface TopicRepository {
  list(): Promise<TopicEntity[]>;
  save(topic: TopicEntity): Promise<void>;
  saveMany(topics: TopicEntity[]): Promise<void>;
}

export interface CategoryRepository {
  list(): Promise<CategoryEntity[]>;
  save(category: CategoryEntity): Promise<void>;
  saveMany(categories: CategoryEntity[]): Promise<void>;
  delete(categoryId: string): Promise<void>;
}

export interface TabSessionRepository {
  get(): Promise<AppSession>;
  save(session: AppSession): Promise<void>;
}

export interface SettingsRepository {
  get(): Promise<UserSettings>;
  save(settings: UserSettings): Promise<void>;
}

export interface WorkspaceSyncBridge {
  subscribe(
    onChange: () => void,
    onError?: (error: Error) => void
  ): () => void;
}

export interface RepositorySet {
  kind: "local" | "firebase" | "api";
  pages: PageRepository;
  topics: TopicRepository;
  categories: CategoryRepository;
  session: TabSessionRepository;
  settings: SettingsRepository;
  sync?: WorkspaceSyncBridge;
}
