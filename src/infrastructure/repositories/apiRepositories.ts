import type {
  AppSession,
  CategoryEntity,
  PageEntity,
  TopicEntity,
  UserSettings
} from "../../domain/models";
import type {
  CategoryRepository,
  PageRepository,
  RepositorySet,
  SettingsRepository,
  TabSessionRepository,
  TopicRepository,
  WorkspaceSyncBridge
} from "../../domain/repositories";
import type { WorkspaceApiClient } from "../api/client";

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

class ApiPageRepository implements PageRepository {
  constructor(private readonly client: WorkspaceApiClient) {}

  async list() {
    const workspace = await this.client.getWorkspace();
    return cloneValue(workspace.snapshot.pages);
  }

  async save(page: PageEntity) {
    await this.client.savePage(page);
  }

  async saveMany(pages: PageEntity[]) {
    await this.client.savePages(pages);
  }
}

class ApiTopicRepository implements TopicRepository {
  constructor(private readonly client: WorkspaceApiClient) {}

  async list() {
    const workspace = await this.client.getWorkspace();
    return cloneValue(workspace.snapshot.topics);
  }

  async save(topic: TopicEntity) {
    await this.client.saveTopic(topic);
  }

  async saveMany(topics: TopicEntity[]) {
    await this.client.saveTopics(topics);
  }
}

class ApiCategoryRepository implements CategoryRepository {
  constructor(private readonly client: WorkspaceApiClient) {}

  async list() {
    const workspace = await this.client.getWorkspace();
    return cloneValue(workspace.snapshot.categories);
  }

  async save(category: CategoryEntity) {
    await this.client.saveCategory(category);
  }

  async saveMany(categories: CategoryEntity[]) {
    await this.client.saveCategories(categories);
  }

  async delete(categoryId: string) {
    await this.client.deleteCategory(categoryId);
  }
}

class ApiSessionRepository implements TabSessionRepository {
  constructor(private readonly client: WorkspaceApiClient) {}

  async get(): Promise<AppSession> {
    const workspace = await this.client.getWorkspace();
    return cloneValue(workspace.snapshot.session);
  }

  async save(session: AppSession) {
    await this.client.saveSession(session);
  }
}

class ApiSettingsRepository implements SettingsRepository {
  constructor(private readonly client: WorkspaceApiClient) {}

  async get(): Promise<UserSettings> {
    const workspace = await this.client.getWorkspace();
    return cloneValue(workspace.snapshot.settings);
  }

  async save(settings: UserSettings) {
    await this.client.saveSettings(settings);
  }
}

class ApiWorkspaceSync implements WorkspaceSyncBridge {
  constructor(
    private readonly client: WorkspaceApiClient,
    private readonly syncIntervalMs: number
  ) {}

  subscribe(onChange: () => void, onError?: (error: Error) => void) {
    let isDisposed = false;
    let timeoutId: number | null = null;
    let lastRevision = this.client.getCachedRevision();

    const schedule = () => {
      if (isDisposed) {
        return;
      }

      timeoutId = window.setTimeout(() => {
        void poll();
      }, this.syncIntervalMs);
    };

    const poll = async () => {
      if (isDisposed) {
        return;
      }

      try {
        const { revision } = await this.client.getRevision();
        if (revision !== lastRevision) {
          lastRevision = revision;
          this.client.invalidateWorkspace();
          onChange();
        }
      } catch (caught) {
        if (onError) {
          onError(caught instanceof Error ? caught : new Error("Workspace sync failed"));
        }
      } finally {
        schedule();
      }
    };

    schedule();

    return () => {
      isDisposed = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }
}

export function createApiRepositorySet(
  client: WorkspaceApiClient,
  syncIntervalMs: number
): RepositorySet {
  return {
    kind: "api",
    pages: new ApiPageRepository(client),
    topics: new ApiTopicRepository(client),
    categories: new ApiCategoryRepository(client),
    session: new ApiSessionRepository(client),
    settings: new ApiSettingsRepository(client),
    sync: new ApiWorkspaceSync(client, syncIntervalMs)
  };
}
