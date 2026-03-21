import { WorkspaceService } from "../application/WorkspaceService";
import type { RepositorySet } from "../domain/repositories";
import { firebaseServices } from "../infrastructure/firebase/client";
import { createFirebaseRepositorySet } from "../infrastructure/repositories/firebaseRepositories";
import { createLocalRepositorySet } from "../infrastructure/repositories/localRepositories";

export function createRepositorySet(uid: string | null): RepositorySet | null {
  if (firebaseServices.isConfigured && firebaseServices.db) {
    return uid ? createFirebaseRepositorySet(firebaseServices.db, uid) : null;
  }

  return createLocalRepositorySet();
}

export function createWorkspaceService(repositories: RepositorySet) {
  return new WorkspaceService(repositories);
}
