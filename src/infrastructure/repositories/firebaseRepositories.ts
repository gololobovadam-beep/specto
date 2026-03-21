import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
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

class FirebasePageRepository implements PageRepository {
  constructor(private readonly db: Firestore, private readonly uid: string) {}

  async list() {
    const snapshot = await getDocs(collection(this.db, "users", this.uid, "pages"));
    return snapshot.docs.map((item) => item.data() as PageEntity);
  }

  async save(page: PageEntity) {
    await setDoc(doc(this.db, "users", this.uid, "pages", page.id), page);
  }

  async saveMany(pages: PageEntity[]) {
    const batch = writeBatch(this.db);
    for (const page of pages) {
      batch.set(doc(this.db, "users", this.uid, "pages", page.id), page);
    }
    await batch.commit();
  }
}

class FirebaseTopicRepository implements TopicRepository {
  constructor(private readonly db: Firestore, private readonly uid: string) {}

  async list() {
    const snapshot = await getDocs(collection(this.db, "users", this.uid, "topics"));
    return snapshot.docs.map((item) => item.data() as TopicEntity);
  }

  async save(topic: TopicEntity) {
    await setDoc(doc(this.db, "users", this.uid, "topics", topic.id), topic);
  }

  async saveMany(topics: TopicEntity[]) {
    const batch = writeBatch(this.db);
    for (const topic of topics) {
      batch.set(doc(this.db, "users", this.uid, "topics", topic.id), topic);
    }
    await batch.commit();
  }
}

class FirebaseCategoryRepository implements CategoryRepository {
  constructor(private readonly db: Firestore, private readonly uid: string) {}

  async list() {
    const snapshot = await getDocs(collection(this.db, "users", this.uid, "categories"));
    return snapshot.docs.map((item) => item.data() as CategoryEntity);
  }

  async save(category: CategoryEntity) {
    await setDoc(doc(this.db, "users", this.uid, "categories", category.id), category);
  }

  async saveMany(categories: CategoryEntity[]) {
    const batch = writeBatch(this.db);
    for (const category of categories) {
      batch.set(doc(this.db, "users", this.uid, "categories", category.id), category);
    }
    await batch.commit();
  }
}

class FirebaseSessionRepository implements TabSessionRepository {
  constructor(private readonly db: Firestore, private readonly uid: string) {}

  async get(): Promise<AppSession> {
    const snapshot = await getDoc(doc(this.db, "users", this.uid, "meta", "session"));
    return snapshot.exists() ? (snapshot.data() as AppSession) : createDefaultSession();
  }

  async save(session: AppSession) {
    await setDoc(doc(this.db, "users", this.uid, "meta", "session"), session);
  }
}

class FirebaseSettingsRepository implements SettingsRepository {
  constructor(private readonly db: Firestore, private readonly uid: string) {}

  async get(): Promise<UserSettings> {
    const snapshot = await getDoc(doc(this.db, "users", this.uid, "meta", "settings"));
    return snapshot.exists() ? (snapshot.data() as UserSettings) : createDefaultSettings();
  }

  async save(settings: UserSettings) {
    await setDoc(doc(this.db, "users", this.uid, "meta", "settings"), settings);
  }
}

class FirebaseWorkspaceSync implements WorkspaceSyncBridge {
  constructor(private readonly db: Firestore, private readonly uid: string) {}

  subscribe(onChange: () => void, onError?: (error: Error) => void) {
    const handleError = (caught: unknown) => {
      if (!onError) {
        return;
      }

      onError(caught instanceof Error ? caught : new Error("Sync listener failed"));
    };

    const unsubscribers = [
      onSnapshot(collection(this.db, "users", this.uid, "pages"), () => onChange(), handleError),
      onSnapshot(collection(this.db, "users", this.uid, "topics"), () => onChange(), handleError),
      onSnapshot(collection(this.db, "users", this.uid, "categories"), () => onChange(), handleError),
      onSnapshot(doc(this.db, "users", this.uid, "meta", "session"), () => onChange(), handleError),
      onSnapshot(doc(this.db, "users", this.uid, "meta", "settings"), () => onChange(), handleError)
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }
}

export function createFirebaseRepositorySet(db: Firestore, uid: string): RepositorySet {
  return {
    kind: "firebase",
    pages: new FirebasePageRepository(db, uid),
    topics: new FirebaseTopicRepository(db, uid),
    categories: new FirebaseCategoryRepository(db, uid),
    session: new FirebaseSessionRepository(db, uid),
    settings: new FirebaseSettingsRepository(db, uid),
    sync: new FirebaseWorkspaceSync(db, uid)
  };
}
