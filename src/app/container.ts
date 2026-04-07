import { WorkspaceService } from "../application/WorkspaceService";
import type { RepositorySet } from "../domain/repositories";
import { workspaceApiServices } from "../infrastructure/api/client";
import { firebaseServices } from "../infrastructure/firebase/client";
import { createApiRepositorySet } from "../infrastructure/repositories/apiRepositories";
import { createFirebaseRepositorySet } from "../infrastructure/repositories/firebaseRepositories";
import { createLocalRepositorySet } from "../infrastructure/repositories/localRepositories";

export function createRepositorySet(uid: string | null): RepositorySet | null {
  if (workspaceApiServices.isConfigured && workspaceApiServices.client) {
    return uid
      ? createApiRepositorySet(workspaceApiServices.client, workspaceApiServices.syncIntervalMs)
      : null;
  }

  if (firebaseServices.isConfigured && firebaseServices.db) {
    return uid ? createFirebaseRepositorySet(firebaseServices.db, uid) : null;
  }

  return createLocalRepositorySet();
}

export function getConfiguredStorageKind(): RepositorySet["kind"] {
  if (workspaceApiServices.isConfigured && workspaceApiServices.client) {
    return "api";
  }

  if (firebaseServices.isConfigured && firebaseServices.db) {
    return "firebase";
  }

  return "local";
}

export function createWorkspaceService(repositories: RepositorySet) {
  return new WorkspaceService(repositories);
}
