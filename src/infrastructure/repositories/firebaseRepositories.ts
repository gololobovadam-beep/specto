import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type Firestore
} from "firebase/firestore";
import { createDefaultSession, createDefaultSettings } from "../../domain/defaults";
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

const FIRESTORE_BATCH_LIMIT = 450;

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function areValuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function replaceEntity<T extends { id: string }>(items: T[], next: T): T[] {
  const nextClone = cloneValue(next);
  const existingIndex = items.findIndex((item) => item.id === nextClone.id);
  if (existingIndex === -1) {
    return [...items, nextClone];
  }

  return items.map((item) => (item.id === nextClone.id ? nextClone : item));
}

function replaceEntities<T extends { id: string }>(items: T[], nextItems: T[]) {
  return nextItems.reduce((current, item) => replaceEntity(current, item), items);
}

function sortEntitiesById<T extends { id: string }>(items: T[]) {
  return [...items].sort((left, right) => left.id.localeCompare(right.id));
}

function areEntityCollectionsEqual<T extends { id: string }>(left: T[], right: T[]) {
  return areValuesEqual(sortEntitiesById(left), sortEntitiesById(right));
}

async function commitSetBatchInChunks<T>(
  db: Firestore,
  items: T[],
  getReference: (item: T) => DocumentReference
) {
  for (let startIndex = 0; startIndex < items.length; startIndex += FIRESTORE_BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = items.slice(startIndex, startIndex + FIRESTORE_BATCH_LIMIT);
    for (const item of chunk) {
      batch.set(getReference(item), item as DocumentData);
    }
    await batch.commit();
  }
}

class FirebaseWorkspaceCache {
  private pages: PageEntity[] | null = null;
  private pagesPromise: Promise<PageEntity[]> | null = null;
  private topics: TopicEntity[] | null = null;
  private topicsPromise: Promise<TopicEntity[]> | null = null;
  private categories: CategoryEntity[] | null = null;
  private categoriesPromise: Promise<CategoryEntity[]> | null = null;
  private sessionExists: boolean | null = null;
  private sessionValue: AppSession | null = null;
  private sessionPromise: Promise<AppSession> | null = null;
  private settingsExists: boolean | null = null;
  private settingsValue: UserSettings | null = null;
  private settingsPromise: Promise<UserSettings> | null = null;

  constructor(
    private readonly db: Firestore,
    private readonly uid: string
  ) {}

  async listPages() {
    if (this.pages) {
      return cloneValue(this.pages);
    }

    if (this.pagesPromise) {
      return cloneValue(await this.pagesPromise);
    }

    this.pagesPromise = this.fetchCollection<PageEntity>(collection(this.db, "users", this.uid, "pages")).then(
      (pages) => {
        this.pages = cloneValue(pages);
        return pages;
      }
    );

    try {
      return cloneValue(await this.pagesPromise);
    } finally {
      this.pagesPromise = null;
    }
  }

  async listTopics() {
    if (this.topics) {
      return cloneValue(this.topics);
    }

    if (this.topicsPromise) {
      return cloneValue(await this.topicsPromise);
    }

    this.topicsPromise = this.fetchCollection<TopicEntity>(collection(this.db, "users", this.uid, "topics")).then(
      (topics) => {
        this.topics = cloneValue(topics);
        return topics;
      }
    );

    try {
      return cloneValue(await this.topicsPromise);
    } finally {
      this.topicsPromise = null;
    }
  }

  async listCategories() {
    if (this.categories) {
      return cloneValue(this.categories);
    }

    if (this.categoriesPromise) {
      return cloneValue(await this.categoriesPromise);
    }

    this.categoriesPromise = this.fetchCollection<CategoryEntity>(
      collection(this.db, "users", this.uid, "categories")
    ).then((categories) => {
      this.categories = cloneValue(categories);
      return categories;
    });

    try {
      return cloneValue(await this.categoriesPromise);
    } finally {
      this.categoriesPromise = null;
    }
  }

  async getSession() {
    if (this.sessionExists !== null) {
      return this.sessionExists && this.sessionValue
        ? cloneValue(this.sessionValue)
        : createDefaultSession();
    }

    if (this.sessionPromise) {
      return cloneValue(await this.sessionPromise);
    }

    this.sessionPromise = getDoc(doc(this.db, "users", this.uid, "meta", "session")).then((snapshot) => {
      if (snapshot.exists()) {
        const session = snapshot.data() as AppSession;
        this.sessionExists = true;
        this.sessionValue = cloneValue(session);
        return session;
      }

      this.sessionExists = false;
      this.sessionValue = null;
      return createDefaultSession();
    });

    try {
      return cloneValue(await this.sessionPromise);
    } finally {
      this.sessionPromise = null;
    }
  }

  async getSettings() {
    if (this.settingsExists !== null) {
      return this.settingsExists && this.settingsValue
        ? cloneValue(this.settingsValue)
        : createDefaultSettings();
    }

    if (this.settingsPromise) {
      return cloneValue(await this.settingsPromise);
    }

    this.settingsPromise = getDoc(doc(this.db, "users", this.uid, "meta", "settings")).then((snapshot) => {
      if (snapshot.exists()) {
        const settings = snapshot.data() as UserSettings;
        this.settingsExists = true;
        this.settingsValue = cloneValue(settings);
        return settings;
      }

      this.settingsExists = false;
      this.settingsValue = null;
      return createDefaultSettings();
    });

    try {
      return cloneValue(await this.settingsPromise);
    } finally {
      this.settingsPromise = null;
    }
  }

  getPagesNeedingWrite(pages: PageEntity[]) {
    if (!this.pages) {
      return pages.map((page) => cloneValue(page));
    }

    return pages
      .filter((page) => {
        const cached = this.pages?.find((item) => item.id === page.id);
        return !cached || !areValuesEqual(cached, page);
      })
      .map((page) => cloneValue(page));
  }

  getTopicsNeedingWrite(topics: TopicEntity[]) {
    if (!this.topics) {
      return topics.map((topic) => cloneValue(topic));
    }

    return topics
      .filter((topic) => {
        const cached = this.topics?.find((item) => item.id === topic.id);
        return !cached || !areValuesEqual(cached, topic);
      })
      .map((topic) => cloneValue(topic));
  }

  getCategoriesNeedingWrite(categories: CategoryEntity[]) {
    if (!this.categories) {
      return categories.map((category) => cloneValue(category));
    }

    return categories
      .filter((category) => {
        const cached = this.categories?.find((item) => item.id === category.id);
        return !cached || !areValuesEqual(cached, category);
      })
      .map((category) => cloneValue(category));
  }

  shouldWriteSession(session: AppSession) {
    return this.sessionExists !== true || !this.sessionValue || !areValuesEqual(this.sessionValue, session);
  }

  shouldWriteSettings(settings: UserSettings) {
    return this.settingsExists !== true || !this.settingsValue || !areValuesEqual(this.settingsValue, settings);
  }

  hasCategory(categoryId: string) {
    if (!this.categories) {
      return undefined;
    }

    return this.categories.some((category) => category.id === categoryId);
  }

  applyPagesWrite(pages: PageEntity[]) {
    if (!this.pages) {
      return;
    }

    this.pages = replaceEntities(this.pages, pages);
  }

  applyTopicsWrite(topics: TopicEntity[]) {
    if (!this.topics) {
      return;
    }

    this.topics = replaceEntities(this.topics, topics);
  }

  applyCategoriesWrite(categories: CategoryEntity[]) {
    if (!this.categories) {
      return;
    }

    this.categories = replaceEntities(this.categories, categories);
  }

  applyCategoryDelete(categoryId: string) {
    if (!this.categories) {
      return;
    }

    this.categories = this.categories.filter((category) => category.id !== categoryId);
  }

  applySessionWrite(session: AppSession) {
    this.sessionExists = true;
    this.sessionValue = cloneValue(session);
  }

  applySettingsWrite(settings: UserSettings) {
    this.settingsExists = true;
    this.settingsValue = cloneValue(settings);
  }

  invalidatePages() {
    this.pages = null;
    this.pagesPromise = null;
  }

  invalidateTopics() {
    this.topics = null;
    this.topicsPromise = null;
  }

  invalidateCategories() {
    this.categories = null;
    this.categoriesPromise = null;
  }

  invalidateSession() {
    this.sessionExists = null;
    this.sessionValue = null;
    this.sessionPromise = null;
  }

  invalidateSettings() {
    this.settingsExists = null;
    this.settingsValue = null;
    this.settingsPromise = null;
  }

  updatePagesFromSnapshot(pages: PageEntity[]) {
    const nextPages = pages.map((page) => cloneValue(page));
    const hasChanged = this.pages !== null && !areEntityCollectionsEqual(this.pages, nextPages);
    this.pages = nextPages;
    return hasChanged;
  }

  updateTopicsFromSnapshot(topics: TopicEntity[]) {
    const nextTopics = topics.map((topic) => cloneValue(topic));
    const hasChanged = this.topics !== null && !areEntityCollectionsEqual(this.topics, nextTopics);
    this.topics = nextTopics;
    return hasChanged;
  }

  updateCategoriesFromSnapshot(categories: CategoryEntity[]) {
    const nextCategories = categories.map((category) => cloneValue(category));
    const hasChanged =
      this.categories !== null && !areEntityCollectionsEqual(this.categories, nextCategories);
    this.categories = nextCategories;
    return hasChanged;
  }

  updateSessionFromSnapshot(session: AppSession | null) {
    const hasChanged =
      this.sessionExists !== null &&
      (this.sessionExists !== Boolean(session) ||
        (Boolean(session) && !areValuesEqual(this.sessionValue, session)));

    this.sessionExists = Boolean(session);
    this.sessionValue = session ? cloneValue(session) : null;
    return hasChanged;
  }

  updateSettingsFromSnapshot(settings: UserSettings | null) {
    const hasChanged =
      this.settingsExists !== null &&
      (this.settingsExists !== Boolean(settings) ||
        (Boolean(settings) && !areValuesEqual(this.settingsValue, settings)));

    this.settingsExists = Boolean(settings);
    this.settingsValue = settings ? cloneValue(settings) : null;
    return hasChanged;
  }

  private async fetchCollection<T>(reference: ReturnType<typeof collection>) {
    const snapshot = await getDocs(reference);
    return snapshot.docs.map((item) => item.data() as T);
  }
}

class FirebasePageRepository implements PageRepository {
  constructor(
    private readonly db: Firestore,
    private readonly uid: string,
    private readonly cache: FirebaseWorkspaceCache
  ) {}

  async list() {
    return this.cache.listPages();
  }

  async save(page: PageEntity) {
    const changedPages = this.cache.getPagesNeedingWrite([page]);
    if (changedPages.length === 0) {
      return;
    }

    this.cache.applyPagesWrite(changedPages);

    try {
      await setDoc(doc(this.db, "users", this.uid, "pages", page.id), page);
    } catch (caught) {
      this.cache.invalidatePages();
      throw caught;
    }
  }

  async saveMany(pages: PageEntity[]) {
    const changedPages = this.cache.getPagesNeedingWrite(pages);
    if (changedPages.length === 0) {
      return;
    }

    this.cache.applyPagesWrite(changedPages);

    try {
      await commitSetBatchInChunks(this.db, changedPages, (page) =>
        doc(this.db, "users", this.uid, "pages", page.id)
      );
    } catch (caught) {
      this.cache.invalidatePages();
      throw caught;
    }
  }
}

class FirebaseTopicRepository implements TopicRepository {
  constructor(
    private readonly db: Firestore,
    private readonly uid: string,
    private readonly cache: FirebaseWorkspaceCache
  ) {}

  async list() {
    return this.cache.listTopics();
  }

  async save(topic: TopicEntity) {
    const changedTopics = this.cache.getTopicsNeedingWrite([topic]);
    if (changedTopics.length === 0) {
      return;
    }

    this.cache.applyTopicsWrite(changedTopics);

    try {
      await setDoc(doc(this.db, "users", this.uid, "topics", topic.id), topic);
    } catch (caught) {
      this.cache.invalidateTopics();
      throw caught;
    }
  }

  async saveMany(topics: TopicEntity[]) {
    const changedTopics = this.cache.getTopicsNeedingWrite(topics);
    if (changedTopics.length === 0) {
      return;
    }

    this.cache.applyTopicsWrite(changedTopics);

    try {
      await commitSetBatchInChunks(this.db, changedTopics, (topic) =>
        doc(this.db, "users", this.uid, "topics", topic.id)
      );
    } catch (caught) {
      this.cache.invalidateTopics();
      throw caught;
    }
  }
}

class FirebaseCategoryRepository implements CategoryRepository {
  constructor(
    private readonly db: Firestore,
    private readonly uid: string,
    private readonly cache: FirebaseWorkspaceCache
  ) {}

  async list() {
    return this.cache.listCategories();
  }

  async save(category: CategoryEntity) {
    const changedCategories = this.cache.getCategoriesNeedingWrite([category]);
    if (changedCategories.length === 0) {
      return;
    }

    this.cache.applyCategoriesWrite(changedCategories);

    try {
      await setDoc(doc(this.db, "users", this.uid, "categories", category.id), category);
    } catch (caught) {
      this.cache.invalidateCategories();
      throw caught;
    }
  }

  async saveMany(categories: CategoryEntity[]) {
    const changedCategories = this.cache.getCategoriesNeedingWrite(categories);
    if (changedCategories.length === 0) {
      return;
    }

    this.cache.applyCategoriesWrite(changedCategories);

    try {
      await commitSetBatchInChunks(this.db, changedCategories, (category) =>
        doc(this.db, "users", this.uid, "categories", category.id)
      );
    } catch (caught) {
      this.cache.invalidateCategories();
      throw caught;
    }
  }

  async delete(categoryId: string) {
    if (this.cache.hasCategory(categoryId) === false) {
      return;
    }

    this.cache.applyCategoryDelete(categoryId);

    try {
      await deleteDoc(doc(this.db, "users", this.uid, "categories", categoryId));
    } catch (caught) {
      this.cache.invalidateCategories();
      throw caught;
    }
  }
}

class FirebaseSessionRepository implements TabSessionRepository {
  constructor(
    private readonly db: Firestore,
    private readonly uid: string,
    private readonly cache: FirebaseWorkspaceCache
  ) {}

  async get(): Promise<AppSession> {
    return this.cache.getSession();
  }

  async save(session: AppSession) {
    if (!this.cache.shouldWriteSession(session)) {
      return;
    }

    this.cache.applySessionWrite(session);

    try {
      await setDoc(doc(this.db, "users", this.uid, "meta", "session"), session);
    } catch (caught) {
      this.cache.invalidateSession();
      throw caught;
    }
  }
}

class FirebaseSettingsRepository implements SettingsRepository {
  constructor(
    private readonly db: Firestore,
    private readonly uid: string,
    private readonly cache: FirebaseWorkspaceCache
  ) {}

  async get(): Promise<UserSettings> {
    return this.cache.getSettings();
  }

  async save(settings: UserSettings) {
    if (!this.cache.shouldWriteSettings(settings)) {
      return;
    }

    this.cache.applySettingsWrite(settings);

    try {
      await setDoc(doc(this.db, "users", this.uid, "meta", "settings"), settings);
    } catch (caught) {
      this.cache.invalidateSettings();
      throw caught;
    }
  }
}

class FirebaseWorkspaceSync implements WorkspaceSyncBridge {
  constructor(
    private readonly db: Firestore,
    private readonly uid: string,
    private readonly cache: FirebaseWorkspaceCache
  ) {}

  subscribe(onChange: () => void, onError?: (error: Error) => void) {
    const handleError = (caught: unknown) => {
      if (!onError) {
        return;
      }

      onError(caught instanceof Error ? caught : new Error("Sync listener failed"));
    };

    const unsubscribers = [
      onSnapshot(
        collection(this.db, "users", this.uid, "pages"),
        (snapshot) => {
          if (this.cache.updatePagesFromSnapshot(snapshot.docs.map((item) => item.data() as PageEntity))) {
            onChange();
          }
        },
        handleError
      ),
      onSnapshot(
        collection(this.db, "users", this.uid, "topics"),
        (snapshot) => {
          if (this.cache.updateTopicsFromSnapshot(snapshot.docs.map((item) => item.data() as TopicEntity))) {
            onChange();
          }
        },
        handleError
      ),
      onSnapshot(
        collection(this.db, "users", this.uid, "categories"),
        (snapshot) => {
          if (
            this.cache.updateCategoriesFromSnapshot(
              snapshot.docs.map((item) => item.data() as CategoryEntity)
            )
          ) {
            onChange();
          }
        },
        handleError
      ),
      onSnapshot(
        doc(this.db, "users", this.uid, "meta", "session"),
        (snapshot) => {
          if (this.cache.updateSessionFromSnapshot(snapshot.exists() ? (snapshot.data() as AppSession) : null)) {
            onChange();
          }
        },
        handleError
      ),
      onSnapshot(
        doc(this.db, "users", this.uid, "meta", "settings"),
        (snapshot) => {
          if (
            this.cache.updateSettingsFromSnapshot(
              snapshot.exists() ? (snapshot.data() as UserSettings) : null
            )
          ) {
            onChange();
          }
        },
        handleError
      )
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }
}

export function createFirebaseRepositorySet(db: Firestore, uid: string): RepositorySet {
  const cache = new FirebaseWorkspaceCache(db, uid);

  return {
    kind: "firebase",
    pages: new FirebasePageRepository(db, uid, cache),
    topics: new FirebaseTopicRepository(db, uid, cache),
    categories: new FirebaseCategoryRepository(db, uid, cache),
    session: new FirebaseSessionRepository(db, uid, cache),
    settings: new FirebaseSettingsRepository(db, uid, cache),
    sync: new FirebaseWorkspaceSync(db, uid, cache)
  };
}
