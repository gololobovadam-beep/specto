import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore
} from "firebase/firestore";

const FIREBASE_APP_HOST_SUFFIX = ".firebaseapp.com";
const FIREBASE_WEB_HOST_SUFFIX = ".web.app";

type BrowserWindow = Pick<Window, "location">;

function getBrowserWindow(): BrowserWindow | undefined {
  return typeof window === "undefined" ? undefined : window;
}

function getFirebaseHostingProjectId(host: string) {
  if (host.endsWith(FIREBASE_APP_HOST_SUFFIX)) {
    return host.slice(0, -FIREBASE_APP_HOST_SUFFIX.length);
  }

  if (host.endsWith(FIREBASE_WEB_HOST_SUFFIX)) {
    return host.slice(0, -FIREBASE_WEB_HOST_SUFFIX.length);
  }

  return null;
}

/**
 * НЕ подменяем authDomain на текущий хост.
 * authDomain ВСЕГДА должен быть .firebaseapp.com — именно через него
 * Firebase auth iframe общается с Google OAuth.
 * Если подставить .web.app, iframe получает parent=web.app при том что
 * сам hosted на firebaseapp.com — cross-origin блок, redirect никогда не завершается.
 */
export function resolveFirebaseAuthDomain(
  configuredAuthDomain: string | undefined,
  _browserWindow: BrowserWindow | null | undefined = getBrowserWindow()
) {
  if (!configuredAuthDomain) {
    return configuredAuthDomain;
  }

  // Если вдруг в .env указан .web.app — автоматически конвертируем в .firebaseapp.com
  if (configuredAuthDomain.endsWith(FIREBASE_WEB_HOST_SUFFIX)) {
    const projectId = getFirebaseHostingProjectId(configuredAuthDomain);
    if (projectId) {
      return `${projectId}${FIREBASE_APP_HOST_SUFFIX}`;
    }
  }

  return configuredAuthDomain;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: resolveFirebaseAuthDomain(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const isConfigured = Object.values(firebaseConfig).every(Boolean);
const workspaceApiBaseUrl = import.meta.env.VITE_WORKSPACE_API_BASE_URL?.trim();
const shouldInitializeFirestore = !workspaceApiBaseUrl;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (isConfigured) {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: "select_account" });

  if (shouldInitializeFirestore) {
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
    } catch {
      db = getFirestore(app);
    }
  }
}

export const firebaseServices = {
  isConfigured,
  app,
  auth,
  db,
  googleProvider,
  configuredAuthDomain: firebaseConfig.authDomain
};
