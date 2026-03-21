import type { WorkspaceService } from "../../application/WorkspaceService";
import type { WorkspaceSnapshot } from "../../domain/models";
import { LocalWorkspaceStore } from "../storage/localWorkspaceStore";

const localStore = new LocalWorkspaceStore();

export async function maybeMigrateLocalWorkspace(
  service: WorkspaceService,
  uid: string,
  remoteSnapshot: WorkspaceSnapshot
) {
  const remoteHasContent =
    remoteSnapshot.pages.some((page) => !page.deletedAt) ||
    remoteSnapshot.topics.some((topic) => !topic.deletedAt);

  if (remoteHasContent) {
    return remoteSnapshot;
  }

  if (localStore.getMigrationMarker(uid) || !localStore.hasMeaningfulContent()) {
    return remoteSnapshot;
  }

  const migratedSnapshot = await service.importWorkspace(localStore.read());
  localStore.markMigrated(uid);
  return migratedSnapshot;
}
