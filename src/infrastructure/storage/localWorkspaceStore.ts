import { createDefaultWorkspaceSnapshot } from "../../domain/factories";
import type { WorkspaceSnapshot } from "../../domain/models";

const STORAGE_KEY = "study-pages.workspace.v1";
const MIGRATION_PREFIX = "study-pages.firebase-migrated";

export class LocalWorkspaceStore {
  read(): WorkspaceSnapshot {
    if (typeof window === "undefined") {
      return createDefaultWorkspaceSnapshot();
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultWorkspaceSnapshot();
    }

    try {
      const parsed = JSON.parse(raw) as WorkspaceSnapshot;
      return {
        ...createDefaultWorkspaceSnapshot(),
        ...parsed
      };
    } catch {
      return createDefaultWorkspaceSnapshot();
    }
  }

  write(snapshot: WorkspaceSnapshot) {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }

  hasMeaningfulContent() {
    const snapshot = this.read();
    return snapshot.pages.some((page) => !page.deletedAt) || snapshot.topics.some((topic) => !topic.deletedAt);
  }

  getMigrationMarker(uid: string) {
    if (typeof window === "undefined") {
      return null;
    }

    return window.localStorage.getItem(`${MIGRATION_PREFIX}:${uid}`);
  }

  markMigrated(uid: string) {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(`${MIGRATION_PREFIX}:${uid}`, new Date().toISOString());
  }
}
