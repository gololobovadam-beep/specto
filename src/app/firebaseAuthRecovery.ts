export const FIREBASE_AUTH_HELPER_PREFIX = "/__/auth/";
export const FIREBASE_AUTH_HELPER_RECOVERY_KEY =
  "study-pages.auth.firebase-helper.recovery-attempted";

type ServiceWorkerRegistrationLike = Pick<ServiceWorkerRegistration, "unregister">;
type ServiceWorkerContainerLike = Pick<ServiceWorkerContainer, "getRegistrations">;
type BrowserLocation = Pick<Location, "href" | "pathname" | "replace">;
type SessionStorageLike = Pick<Storage, "getItem" | "setItem">;
type BrowserNavigator = {
  serviceWorker?: ServiceWorkerContainerLike;
};
type BrowserWindow = {
  location: BrowserLocation;
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

export async function recoverFirebaseAuthHelperNavigation(
  browserWindow: BrowserWindow | null | undefined = getBrowserWindow()
) {
  if (!browserWindow || !isFirebaseAuthHelperPath(browserWindow.location.pathname)) {
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

  // Reload the exact helper URL after clearing stale service workers.
  browserWindow.location.replace(browserWindow.location.href);
  return true;
}
