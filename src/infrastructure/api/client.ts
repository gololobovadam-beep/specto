import type {
  AppSession,
  CategoryEntity,
  PageEntity,
  TopicEntity,
  UserSettings,
  WorkspaceSnapshot
} from "../../domain/models";
import { firebaseServices } from "../firebase/client";

export interface WorkspaceEnvelope {
  snapshot: WorkspaceSnapshot;
  revision: string | null;
}

export interface WorkspaceRevision {
  revision: string | null;
}

const FIREBASE_AUTH_HEADER = "X-Firebase-Authorization";

class WorkspaceApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "WorkspaceApiError";
  }
}

function normalizeBaseUrl(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : null;
}

function parseSyncInterval(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 1000 ? parsed : 5000;
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function replaceEntity<T extends { id: string }>(items: T[], next: T): T[] {
  const existingIndex = items.findIndex((item) => item.id === next.id);
  if (existingIndex === -1) {
    return [...items, cloneValue(next)];
  }

  return items.map((item) => (item.id === next.id ? cloneValue(next) : item));
}

async function readErrorMessage(response: Response) {
  const fallbackMessage = `Workspace API request failed with status ${response.status}`;

  try {
    const payload = (await response.json()) as { detail?: string };
    return typeof payload.detail === "string" && payload.detail.trim()
      ? payload.detail
      : fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export class WorkspaceApiClient {
  private workspaceCache: WorkspaceEnvelope | null = null;
  private workspacePromise: Promise<WorkspaceEnvelope> | null = null;
  private lastKnownRevision: string | null = null;

  constructor(private readonly baseUrl: string) {}

  getCachedRevision() {
    return this.lastKnownRevision;
  }

  invalidateWorkspace() {
    this.workspaceCache = null;
    this.workspacePromise = null;
  }

  async getWorkspace(force = false): Promise<WorkspaceEnvelope> {
    if (!force && this.workspaceCache) {
      return cloneValue(this.workspaceCache);
    }

    if (!force && this.workspacePromise) {
      const cached = await this.workspacePromise;
      return cloneValue(cached);
    }

    this.workspacePromise = this.request<WorkspaceEnvelope>("/api/workspace");

    try {
      const envelope = await this.workspacePromise;
      this.workspaceCache = cloneValue(envelope);
      this.lastKnownRevision = envelope.revision;
      return cloneValue(envelope);
    } finally {
      this.workspacePromise = null;
    }
  }

  async getRevision() {
    const revision = await this.request<WorkspaceRevision>("/api/workspace/meta");
    this.lastKnownRevision = revision.revision;
    return revision;
  }

  async savePage(page: PageEntity) {
    const revision = await this.requestMutation(
      `/api/workspace/pages/${encodeURIComponent(page.id)}`,
      { page }
    );
    this.updateWorkspaceCache((snapshot) => {
      snapshot.pages = replaceEntity(snapshot.pages, page);
    }, revision);
  }

  async savePages(pages: PageEntity[]) {
    const revision = await this.requestMutation("/api/workspace/pages/_batch", { pages });
    this.updateWorkspaceCache((snapshot) => {
      snapshot.pages = cloneValue(pages);
    }, revision);
  }

  async saveTopic(topic: TopicEntity) {
    const revision = await this.requestMutation(
      `/api/workspace/topics/${encodeURIComponent(topic.id)}`,
      { topic }
    );
    this.updateWorkspaceCache((snapshot) => {
      snapshot.topics = replaceEntity(snapshot.topics, topic);
    }, revision);
  }

  async saveTopics(topics: TopicEntity[]) {
    const revision = await this.requestMutation("/api/workspace/topics/_batch", { topics });
    this.updateWorkspaceCache((snapshot) => {
      snapshot.topics = cloneValue(topics);
    }, revision);
  }

  async saveCategory(category: CategoryEntity) {
    const revision = await this.requestMutation(
      `/api/workspace/categories/${encodeURIComponent(category.id)}`,
      { category }
    );
    this.updateWorkspaceCache((snapshot) => {
      snapshot.categories = replaceEntity(snapshot.categories, category);
    }, revision);
  }

  async saveCategories(categories: CategoryEntity[]) {
    const revision = await this.requestMutation("/api/workspace/categories/_batch", {
      categories
    });
    this.updateWorkspaceCache((snapshot) => {
      snapshot.categories = cloneValue(categories);
    }, revision);
  }

  async deleteCategory(categoryId: string) {
    const revision = await this.requestMutation(
      `/api/workspace/categories/${encodeURIComponent(categoryId)}`,
      undefined,
      "DELETE"
    );
    this.updateWorkspaceCache((snapshot) => {
      snapshot.categories = snapshot.categories.filter((category) => category.id !== categoryId);
    }, revision);
  }

  async saveSession(session: AppSession) {
    const revision = await this.requestMutation("/api/workspace/session", { session });
    this.updateWorkspaceCache((snapshot) => {
      snapshot.session = cloneValue(session);
    }, revision);
  }

  async saveSettings(settings: UserSettings) {
    const revision = await this.requestMutation("/api/workspace/settings", { settings });
    this.updateWorkspaceCache((snapshot) => {
      snapshot.settings = cloneValue(settings);
    }, revision);
  }

  private async requestMutation(
    path: string,
    body?: unknown,
    method = "PUT"
  ) {
    const revision = await this.request<WorkspaceRevision>(path, {
      method,
      body
    });
    this.lastKnownRevision = revision.revision;
    return revision.revision;
  }

  private async request<T>(
    path: string,
    init: {
      method?: string;
      body?: unknown;
    } = {}
  ): Promise<T> {
    const auth = firebaseServices.auth;
    const user = auth?.currentUser;

    if (!auth || !user) {
      throw new Error("Firebase authentication is required before cloud sync can start");
    }

    const idToken = await user.getIdToken();
    const response = await fetch(this.buildUrl(path), {
      method: init.method ?? "GET",
      headers: {
        [FIREBASE_AUTH_HEADER]: `Bearer ${idToken}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {})
      },
      body: init.body ? JSON.stringify(init.body) : undefined
    });

    if (!response.ok) {
      throw new WorkspaceApiError(await readErrorMessage(response), response.status);
    }

    return (await response.json()) as T;
  }

  private buildUrl(path: string) {
    const relativePath = path.replace(/^\/+/, "");
    return new URL(relativePath, `${this.baseUrl}/`).toString();
  }

  private updateWorkspaceCache(
    mutate: (snapshot: WorkspaceSnapshot) => void,
    revision: string | null
  ) {
    this.lastKnownRevision = revision;

    if (!this.workspaceCache) {
      this.workspacePromise = null;
      return;
    }

    const nextSnapshot = cloneValue(this.workspaceCache.snapshot);
    mutate(nextSnapshot);
    this.workspaceCache = {
      snapshot: nextSnapshot,
      revision
    };
    this.workspacePromise = null;
  }
}

const workspaceApiBaseUrl = normalizeBaseUrl(import.meta.env.VITE_WORKSPACE_API_BASE_URL);
const workspaceApiSyncIntervalMs = parseSyncInterval(
  import.meta.env.VITE_WORKSPACE_API_SYNC_INTERVAL_MS
);

export const workspaceApiServices = {
  isConfigured: Boolean(workspaceApiBaseUrl),
  syncIntervalMs: workspaceApiSyncIntervalMs,
  client: workspaceApiBaseUrl ? new WorkspaceApiClient(workspaceApiBaseUrl) : null
};
