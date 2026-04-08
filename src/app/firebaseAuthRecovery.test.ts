import { describe, expect, it, vi } from "vitest";
import {
  FIREBASE_AUTH_HELPER_RECOVERY_KEY,
  isFirebaseAuthHelperPath,
  isLikelyFirebaseAuthPopupWindow,
  recoverFirebaseAuthHelperNavigation
} from "./firebaseAuthRecovery";

function createSessionStorage() {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    }
  } as Pick<Storage, "getItem" | "setItem">;
}

function createBrowserWindow(
  url: string,
  {
    registrations = [],
    sessionStorage = createSessionStorage(),
    withServiceWorker = true
  }: {
    registrations?: Array<Pick<ServiceWorkerRegistration, "unregister">>;
    sessionStorage?: Pick<Storage, "getItem" | "setItem">;
    withServiceWorker?: boolean;
  } = {}
) {
  const location = new URL(url);
  const replace = vi.fn((nextUrl: string) => {
    location.href = nextUrl;
  });

  return {
    location: Object.assign(location, { replace }) as unknown as Location,
    navigator: withServiceWorker
      ? {
          serviceWorker: {
            getRegistrations: vi.fn().mockResolvedValue(registrations)
          }
        }
      : {},
    document: {
      referrer: ""
    },
    opener: null as object | null,
    sessionStorage
  };
}

describe("firebaseAuthRecovery", () => {
  it("detects Firebase auth helper routes", () => {
    expect(isFirebaseAuthHelperPath("/__/auth/handler")).toBe(true);
    expect(isFirebaseAuthHelperPath("/pages/alpha")).toBe(false);
  });

  it("does nothing outside of Firebase auth helper routes", async () => {
    const browserWindow = createBrowserWindow("https://spectus-33cfe.firebaseapp.com/");

    await expect(recoverFirebaseAuthHelperNavigation(browserWindow)).resolves.toBe(false);
    expect(browserWindow.location.replace).not.toHaveBeenCalled();
    expect(browserWindow.navigator.serviceWorker?.getRegistrations).not.toHaveBeenCalled();
  });

  it("detects Firebase popup windows by auth query params", () => {
    const browserWindow = createBrowserWindow(
      "https://spectus-33cfe.firebaseapp.com/?apiKey=test&authType=signInViaPopup&eventId=123"
    );

    expect(
      isLikelyFirebaseAuthPopupWindow("spectus-33cfe.firebaseapp.com", browserWindow)
    ).toBe(true);
  });

  it("detects a cross-origin Firebase popup window by opener and referrer", () => {
    const browserWindow = createBrowserWindow("https://spectus-33cfe.firebaseapp.com/");
    browserWindow.opener = {};
    browserWindow.document.referrer = "http://localhost:5173/";

    expect(
      isLikelyFirebaseAuthPopupWindow("spectus-33cfe.firebaseapp.com", browserWindow)
    ).toBe(true);
  });

  it("unregisters stale service workers and reloads the helper url once", async () => {
    const unregisterFirst = vi.fn().mockResolvedValue(true);
    const unregisterSecond = vi.fn().mockResolvedValue(true);
    const browserWindow = createBrowserWindow(
      "https://spectus-33cfe.firebaseapp.com/__/auth/handler?apiKey=test",
      {
        registrations: [{ unregister: unregisterFirst }, { unregister: unregisterSecond }]
      }
    );

    await expect(recoverFirebaseAuthHelperNavigation(browserWindow)).resolves.toBe(true);

    expect(
      browserWindow.sessionStorage.getItem(FIREBASE_AUTH_HELPER_RECOVERY_KEY)
    ).toBe("1");
    expect(browserWindow.navigator.serviceWorker?.getRegistrations).toHaveBeenCalledOnce();
    expect(unregisterFirst).toHaveBeenCalledOnce();
    expect(unregisterSecond).toHaveBeenCalledOnce();
    expect(browserWindow.location.replace).toHaveBeenCalledWith(
      "https://spectus-33cfe.firebaseapp.com/__/auth/handler?apiKey=test"
    );
  });

  it("stops after the first recovery attempt to avoid reload loops", async () => {
    const sessionStorage = createSessionStorage();
    sessionStorage.setItem(FIREBASE_AUTH_HELPER_RECOVERY_KEY, "1");
    const browserWindow = createBrowserWindow(
      "https://spectus-33cfe.firebaseapp.com/__/auth/handler?apiKey=test",
      { sessionStorage }
    );

    await expect(recoverFirebaseAuthHelperNavigation(browserWindow)).resolves.toBe(true);

    expect(browserWindow.location.replace).not.toHaveBeenCalled();
    expect(browserWindow.navigator.serviceWorker?.getRegistrations).not.toHaveBeenCalled();
  });

  it("reloads the helper url once even without service worker support", async () => {
    const browserWindow = createBrowserWindow(
      "https://spectus-33cfe.firebaseapp.com/__/auth/handler?apiKey=test",
      { withServiceWorker: false }
    );

    await expect(recoverFirebaseAuthHelperNavigation(browserWindow)).resolves.toBe(true);

    expect(browserWindow.location.replace).toHaveBeenCalledWith(
      "https://spectus-33cfe.firebaseapp.com/__/auth/handler?apiKey=test"
    );
  });
});
