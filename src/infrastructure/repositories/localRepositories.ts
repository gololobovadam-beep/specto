import { createDefaultSession, createDefaultSettings } from "../../domain/defaults";
import type {
  CategoryRepository,
  PageRepository,
  RepositorySet,
  SettingsRepository,
  TabSessionRepository,
  TopicRepository
} from "../../domain/repositories";
import type {
  AppSession,
  CategoryEntity,
  PageEntity,
  TopicEntity,
  UserSettings,
  WorkspaceSnapshot
} from "../../domain/models";
import { LocalWorkspaceStore } from "../storage/localWorkspaceStore";

class LocalRepositoryBase {
  constructor(protected readonly store: LocalWorkspaceStore) {}

  protected read(): WorkspaceSnapshot {
    return this.store.read();
  }

  protected write(snapshot: WorkspaceSnapshot) {
    this.store.write(snapshot);
  }
}

class LocalPageRepository extends LocalRepositoryBase implements PageRepository {
  async list() {
    return this.read().pages;
  }

  async save(page: PageEntity) {
    const snapshot = this.read();
    snapshot.pages = replaceEntity(snapshot.pages, page);
    this.write(snapshot);
  }

  async saveMany(pages: PageEntity[]) {
    const snapshot = this.read();
    snapshot.pages = pages;
    this.write(snapshot);
  }
}

class LocalTopicRepository extends LocalRepositoryBase implements TopicRepository {
  async list() {
    return this.read().topics;
  }

  async save(topic: TopicEntity) {
    const snapshot = this.read();
    snapshot.topics = replaceEntity(snapshot.topics, topic);
    this.write(snapshot);
  }

  async saveMany(topics: TopicEntity[]) {
    const snapshot = this.read();
    snapshot.topics = topics;
    this.write(snapshot);
  }
}

class LocalCategoryRepository
  extends LocalRepositoryBase
  implements CategoryRepository
{
  async list() {
    return this.read().categories;
  }

  async save(category: CategoryEntity) {
    const snapshot = this.read();
    snapshot.categories = replaceEntity(snapshot.categories, category);
    this.write(snapshot);
  }

  async saveMany(categories: CategoryEntity[]) {
    const snapshot = this.read();
    snapshot.categories = categories;
    this.write(snapshot);
  }

  async delete(categoryId: string) {
    const snapshot = this.read();
    snapshot.categories = snapshot.categories.filter((category) => category.id !== categoryId);
    this.write(snapshot);
  }
}

class LocalSessionRepository
  extends LocalRepositoryBase
  implements TabSessionRepository
{
  async get(): Promise<AppSession> {
    return this.read().session ?? createDefaultSession();
  }

  async save(session: AppSession) {
    const snapshot = this.read();
    snapshot.session = session;
    this.write(snapshot);
  }
}

class LocalSettingsRepository
  extends LocalRepositoryBase
  implements SettingsRepository
{
  async get(): Promise<UserSettings> {
    return this.read().settings ?? createDefaultSettings();
  }

  async save(settings: UserSettings) {
    const snapshot = this.read();
    snapshot.settings = settings;
    this.write(snapshot);
  }
}

function replaceEntity<T extends { id: string }>(items: T[], next: T): T[] {
  const existingIndex = items.findIndex((item) => item.id === next.id);
  if (existingIndex === -1) {
    return [...items, next];
  }

  return items.map((item) => (item.id === next.id ? next : item));
}

export function createLocalRepositorySet(): RepositorySet {
  const store = new LocalWorkspaceStore();

  return {
    kind: "local",
    pages: new LocalPageRepository(store),
    topics: new LocalTopicRepository(store),
    categories: new LocalCategoryRepository(store),
    session: new LocalSessionRepository(store),
    settings: new LocalSettingsRepository(store)
  };
}
