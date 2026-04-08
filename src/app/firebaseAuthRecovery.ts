import { firebaseServices } from "../infrastructure/firebase/client";

export const FIREBASE_AUTH_HELPER_PREFIX = "/__/auth/";
export const FIREBASE_AUTH_HELPER_RECOVERY_KEY =
  "study-pages.auth.firebase-helper.recovery-attempted";
const FIREBASE_AUTH_POPUP_QUERY_KEYS = [
  "apiKey",
  "appName",
  "authType",
  "eventId",
  "providerId",
  "redirectUrl",
  "scopes",
  "v"
] as const;

type ServiceWorkerRegistrationLike = Pick<ServiceWorkerRegistration, "unregister">;
type ServiceWorkerContainerLike = Pick<ServiceWorkerContainer, "getRegistrations">;
type BrowserLocation = Pick<Location, "hash" | "host" | "href" | "pathname" | "replace">;
type SessionStorageLike = Pick<Storage, "getItem" | "setItem">;
type BrowserNavigator = {
  serviceWorker?: ServiceWorkerContainerLike;
};
type BrowserWindow = {
  document?: Pick<Document, "referrer">;
  location: BrowserLocation;
  opener?: object | null;
  sessionStorage: SessionStorageLike;
  navigator: BrowserNavigator;
};

function getBrowserWindow(): BrowserWindow | undefined {
  return typeof window === "undefined" ? undefined : (window as BrowserWindow);
}

export function isFirebaseAuthHelperPath(
  pathname = getBrowserWindow()?.location.pathname ?? ""
) {
  return pathname.startsWith(FIREBASE_AUTH_HELPER_PREFIX);
}

function getHostFromUrl(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

function hasFirebasePopupParams(browserWindow: BrowserWindow) {
  const url = new URL(browserWindow.location.href);

  return FIREBASE_AUTH_POPUP_QUERY_KEYS.some(
    (key) => url.searchParams.has(key) || browserWindow.location.hash.includes(`${key}=`)
  );
}

export function isLikelyFirebaseAuthPopupWindow(
  configuredAuthDomain = firebaseServices.configuredAuthDomain,
  browserWindow: BrowserWindow | null | undefined = getBrowserWindow()
) {
  if (!browserWindow || !configuredAuthDomain) {
    return false;
  }

  if (browserWindow.location.host !== configuredAuthDomain) {
    return false;
  }

  if (hasFirebasePopupParams(browserWindow)) {
    return true;
  }

  const referrerHost = browserWindow.document?.referrer
    ? getHostFromUrl(browserWindow.document.referrer)
    : "";

  return Boolean(browserWindow.opener) && Boolean(referrerHost) && referrerHost !== configuredAuthDomain;
}

export async function recoverFirebaseAuthHelperNavigation(
  browserWindow: BrowserWindow | null | undefined = getBrowserWindow()
) {
  const shouldRecover =
    browserWindow &&
    (isFirebaseAuthHelperPath(browserWindow.location.pathname) ||
      isLikelyFirebaseAuthPopupWindow(undefined, browserWindow));

  if (!shouldRecover || !browserWindow) {
    return false;
  }

  if (
    browserWindow.sessionStorage.getItem(FIREBASE_AUTH_HELPER_RECOVERY_KEY) === "1"
  ) {
    return true;
  }

  browserWindow.sessionStorage.setItem(FIREBASE_AUTH_HELPER_RECOVERY_KEY, "1");

  const registrations = await browserWindow.navigator.serviceWorker?.getRegistrations?.();
  if (registrations?.length) {
    await Promise.allSettled(
      registrations.map((registration: ServiceWorkerRegistrationLike) =>
        registration.unregister()
      )
    );
  }

  // Reload the exact popup/helper URL after clearing stale service workers.
  browserWindow.location.replace(browserWindow.location.href);
  return true;
}
