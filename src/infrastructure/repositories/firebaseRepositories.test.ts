import { beforeEach, describe, expect, it, vi } from "vitest";

const firestoreMock = vi.hoisted(() => {
  const collectionData = new Map<string, Array<Record<string, unknown>>>();
  const documentData = new Map<string, Record<string, unknown>>();
  const listeners = new Map<string, Array<(snapshot: unknown) => void>>();
  const batchSet = vi.fn();
  const batchCommit = vi.fn(async () => undefined);

  function cloneValue<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  function collectionPathForDocument(path: string) {
    return path.split("/").slice(0, -1).join("/");
  }

  function syncCollectionDocument(path: string, value: Record<string, unknown>) {
    const collectionPath = collectionPathForDocument(path);
    const nextValue = cloneValue(value);
    const current = collectionData.get(collectionPath) ?? [];
    const nextItems = current.filter((item) => item.id !== nextValue.id);
    collectionData.set(collectionPath, [...nextItems, nextValue]);
  }

  function makeCollectionSnapshot(items: Array<Record<string, unknown>>) {
    return {
      docs: items.map((item) => ({
        data: () => cloneValue(item)
      }))
    };
  }

  function makeDocumentSnapshot(value?: Record<string, unknown>) {
    return {
      exists: () => Boolean(value),
      data: () => (value ? cloneValue(value) : undefined)
    };
  }

  return {
    collectionData,
    documentData,
    listeners,
    batchSet,
    batchCommit,
    reset() {
      collectionData.clear();
      documentData.clear();
      listeners.clear();
      batchSet.mockReset();
      batchCommit.mockReset();
      batchCommit.mockResolvedValue(undefined);
    },
    emitCollection(path: string, items: Array<Record<string, unknown>>) {
      const callbacks = listeners.get(path) ?? [];
      const snapshot = makeCollectionSnapshot(items);
      callbacks.forEach((callback) => callback(snapshot));
    },
    getDocs: vi.fn(async (reference: { path: string }) =>
      makeCollectionSnapshot(collectionData.get(reference.path) ?? [])
    ),
    getDoc: vi.fn(async (reference: { path: string }) =>
      makeDocumentSnapshot(documentData.get(reference.path))
    ),
    setDoc: vi.fn(async (reference: { path: string }, value: Record<string, unknown>) => {
      documentData.set(reference.path, cloneValue(value));
      if ("id" in value) {
        syncCollectionDocument(reference.path, value);
      }
    }),
    deleteDoc: vi.fn(async (reference: { path: string }) => {
      documentData.delete(reference.path);
      const collectionPath = collectionPathForDocument(reference.path);
      const documentId = reference.path.split("/").at(-1);
      const current = collectionData.get(collectionPath) ?? [];
      collectionData.set(
        collectionPath,
        current.filter((item) => item.id !== documentId)
      );
    }),
    writeBatch: vi.fn(() => {
      const operations: Array<{ reference: { path: string }; value: Record<string, unknown> }> = [];

      return {
        set(reference: { path: string }, value: Record<string, unknown>) {
          batchSet(reference, value);
          operations.push({ reference, value: cloneValue(value) });
        },
        commit: vi.fn(async () => {
          batchCommit();
          operations.forEach(({ reference, value }) => {
            documentData.set(reference.path, cloneValue(value));
            if ("id" in value) {
              syncCollectionDocument(reference.path, value);
            }
          });
        })
      };
    }),
    onSnapshot: vi.fn(
      (
        reference: { path: string },
        onNext: (snapshot: unknown) => void
      ) => {
        const current = listeners.get(reference.path) ?? [];
        listeners.set(reference.path, [...current, onNext]);
        return vi.fn();
      }
    )
  };
});

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join("/") })),
  deleteDoc: firestoreMock.deleteDoc,
  doc: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join("/") })),
  getDoc: firestoreMock.getDoc,
  getDocs: firestoreMock.getDocs,
  onSnapshot: firestoreMock.onSnapshot,
  setDoc: firestoreMock.setDoc,
  writeBatch: firestoreMock.writeBatch
}));

import { createFirebaseRepositorySet } from "./firebaseRepositories";

function createPage(
  id: string,
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id,
    title: `Page ${id}`,
    slug: id,
    preferredViewMode: "grid",
    cardSettings: {
      minWidthPx: 240,
      titleFontSizePx: 18,
      titleLines: 4,
      showPreviewContent: true,
      previewLines: 3
    },
    sortOrder: 0,
    topicIds: [],
    deletedAt: null,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...overrides
  };
}

describe("firebaseRepositories", () => {
  beforeEach(() => {
    firestoreMock.reset();
  });

  it("reuses cached collection reads and only batches changed page documents", async () => {
    const pageA = createPage("page-1");
    const pageB = createPage("page-2");
    firestoreMock.collectionData.set("users/user-1/pages", [pageA, pageB]);

    const repositories = createFirebaseRepositorySet({} as never, "user-1");

    await repositories.pages.list();
    await repositories.pages.list();
    await repositories.pages.saveMany([
      pageA,
      {
        ...pageB,
        title: "Updated page",
        updatedAt: "2026-04-02T00:00:00.000Z"
      }
    ]);

    expect(firestoreMock.getDocs).toHaveBeenCalledTimes(1);
    expect(firestoreMock.batchSet).toHaveBeenCalledTimes(1);
    expect(firestoreMock.batchCommit).toHaveBeenCalledTimes(1);
    expect(firestoreMock.batchSet.mock.calls[0]?.[1]).toMatchObject({
      id: "page-2",
      title: "Updated page"
    });
  });

  it("suppresses unchanged realtime page snapshots and reacts to external changes only", async () => {
    const page = createPage("page-1");
    firestoreMock.collectionData.set("users/user-1/pages", [page]);

    const repositories = createFirebaseRepositorySet({} as never, "user-1");
    await repositories.pages.list();

    const onChange = vi.fn();
    const unsubscribe = repositories.sync?.subscribe(onChange);

    firestoreMock.emitCollection("users/user-1/pages", [page]);
    firestoreMock.emitCollection("users/user-1/pages", [
      {
        ...page,
        title: "Changed remotely",
        updatedAt: "2026-04-03T00:00:00.000Z"
      }
    ]);

    expect(onChange).toHaveBeenCalledTimes(1);
    unsubscribe?.();
  });
});
