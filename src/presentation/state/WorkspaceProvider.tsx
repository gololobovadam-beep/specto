import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { createRepositorySet, createWorkspaceService } from "../../app/container";
import { createDefaultWorkspaceSnapshot } from "../../domain/factories";
import type {
  PageCardSettings,
  WorkspaceSnapshot,
  UserSettings,
  ViewMode
} from "../../domain/models";
import { maybeMigrateLocalWorkspace } from "../../infrastructure/firebase/migration";
import { useAuthSession } from "../auth/AuthProvider";

interface TopicInput {
  title: string;
  summary: string;
  bodyMarkdown: string;
  categoryIds: string[];
}

interface WorkspaceContextValue {
  snapshot: WorkspaceSnapshot;
  isLoading: boolean;
  error: string | null;
  storageKind: "local" | "firebase";
  refresh: () => Promise<WorkspaceSnapshot>;
  createPage: (title?: string) => Promise<WorkspaceSnapshot>;
  renamePage: (pageId: string, title: string) => Promise<WorkspaceSnapshot>;
  softDeletePage: (pageId: string) => Promise<WorkspaceSnapshot>;
  reorderPages: (pageIds: string[]) => Promise<WorkspaceSnapshot>;
  setPageViewMode: (pageId: string, mode: ViewMode) => Promise<WorkspaceSnapshot>;
  updatePageCardSettings: (pageId: string, patch: Partial<PageCardSettings>) => Promise<WorkspaceSnapshot>;
  openPageTab: (pageId: string) => Promise<WorkspaceSnapshot>;
  closeTab: (pageId: string) => Promise<WorkspaceSnapshot>;
  showPagesHub: () => Promise<WorkspaceSnapshot>;
  setActiveTab: (pageId: string | null) => Promise<WorkspaceSnapshot>;
  savePageQuery: (pageId: string, searchQuery: string) => Promise<WorkspaceSnapshot>;
  createTopic: (pageId: string, title?: string) => Promise<WorkspaceSnapshot>;
  updateTopic: (topicId: string, input: TopicInput) => Promise<WorkspaceSnapshot>;
  duplicateTopic: (topicId: string) => Promise<WorkspaceSnapshot>;
  softDeleteTopic: (topicId: string) => Promise<WorkspaceSnapshot>;
  reorderTopics: (pageId: string, topicIds: string[]) => Promise<WorkspaceSnapshot>;
  createCategory: (name: string) => Promise<WorkspaceSnapshot>;
  renameCategory: (categoryId: string, name: string) => Promise<WorkspaceSnapshot>;
  hideCategory: (categoryId: string) => Promise<WorkspaceSnapshot>;
  updateSettings: (patch: Partial<UserSettings>) => Promise<WorkspaceSnapshot>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const auth = useAuthSession();
  const repositories = useMemo(() => createRepositorySet(auth.user?.uid ?? null), [auth.user?.uid]);
  const service = useMemo(() => (repositories ? createWorkspaceService(repositories) : null), [repositories]);
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(createDefaultWorkspaceSnapshot());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<WorkspaceSnapshot>) {
    if (!service) {
      return snapshot;
    }

    try {
      setError(null);
      const nextSnapshot = await action();
      setSnapshot(nextSnapshot);
      return nextSnapshot;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unknown workspace error";
      setError(message);
      throw caught;
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!service || !repositories) {
        setSnapshot(createDefaultWorkspaceSnapshot());
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        let nextSnapshot = await service.loadWorkspace();
        if (repositories.kind === "firebase" && auth.user) {
          nextSnapshot = await maybeMigrateLocalWorkspace(service, auth.user.uid, nextSnapshot);
        }

        if (isMounted) {
          setSnapshot(nextSnapshot);
        }
      } catch (caught) {
        if (!isMounted) {
          return;
        }

        const message = caught instanceof Error ? caught.message : "Failed to load workspace";
        setError(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [auth.user, repositories, service]);

  useEffect(() => {
    if (!repositories?.sync || !service) {
      return;
    }

    let timeoutId: number | null = null;

    const unsubscribe = repositories.sync.subscribe(
      () => {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }

        timeoutId = window.setTimeout(() => {
          void service
            .loadWorkspace()
            .then((nextSnapshot) => {
              setSnapshot(nextSnapshot);
              setError(null);
            })
            .catch((caught) => {
              const message = caught instanceof Error ? caught.message : "Realtime sync failed";
              setError(message);
            });
        }, 120);
      },
      (caught) => {
        setError(caught.message);
      }
    );

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      unsubscribe();
    };
  }, [repositories, service]);

  const value: WorkspaceContextValue = {
    snapshot,
    isLoading,
    error,
    storageKind: repositories?.kind ?? (auth.isConfigured ? "firebase" : "local"),
    refresh: () => run(() => service?.loadWorkspace() ?? Promise.resolve(snapshot)),
    createPage: (title) => run(() => service?.createPage(title) ?? Promise.resolve(snapshot)),
    renamePage: (pageId, title) => run(() => service?.renamePage(pageId, title) ?? Promise.resolve(snapshot)),
    softDeletePage: (pageId) => run(() => service?.softDeletePage(pageId) ?? Promise.resolve(snapshot)),
    reorderPages: (pageIds) => run(() => service?.reorderPages(pageIds) ?? Promise.resolve(snapshot)),
    setPageViewMode: (pageId, mode) => run(() => service?.setPageViewMode(pageId, mode) ?? Promise.resolve(snapshot)),
    updatePageCardSettings: (pageId, patch) => run(() => service?.updatePageCardSettings(pageId, patch) ?? Promise.resolve(snapshot)),
    openPageTab: (pageId) => run(() => service?.openPageTab(pageId) ?? Promise.resolve(snapshot)),
    closeTab: (pageId) => run(() => service?.closeTab(pageId) ?? Promise.resolve(snapshot)),
    showPagesHub: () => run(() => service?.showPagesHub() ?? Promise.resolve(snapshot)),
    setActiveTab: (pageId) => run(() => service?.setActiveTab(pageId) ?? Promise.resolve(snapshot)),
    savePageQuery: (pageId, searchQuery) => run(() => service?.savePageQuery(pageId, searchQuery) ?? Promise.resolve(snapshot)),
    createTopic: (pageId, title) => run(() => service?.createTopic(pageId, title) ?? Promise.resolve(snapshot)),
    updateTopic: (topicId, input) => run(() => service?.updateTopic(topicId, input) ?? Promise.resolve(snapshot)),
    duplicateTopic: (topicId) => run(() => service?.duplicateTopic(topicId) ?? Promise.resolve(snapshot)),
    softDeleteTopic: (topicId) => run(() => service?.softDeleteTopic(topicId) ?? Promise.resolve(snapshot)),
    reorderTopics: (pageId, topicIds) => run(() => service?.reorderTopics(pageId, topicIds) ?? Promise.resolve(snapshot)),
    createCategory: (name) => run(() => service?.createCategory(name) ?? Promise.resolve(snapshot)),
    renameCategory: (categoryId, name) => run(() => service?.renameCategory(categoryId, name) ?? Promise.resolve(snapshot)),
    hideCategory: (categoryId) => run(() => service?.hideCategory(categoryId) ?? Promise.resolve(snapshot)),
    updateSettings: (patch) => run(() => service?.updateSettings(patch) ?? Promise.resolve(snapshot))
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider");
  }

  return context;
}