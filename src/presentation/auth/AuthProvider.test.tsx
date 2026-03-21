import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authModuleMock, firebaseServicesMock } = vi.hoisted(() => ({
  authModuleMock: {
    browserLocalPersistence: { persistence: "local" },
    onAuthStateChanged: vi.fn(),
    setPersistence: vi.fn(),
    signInWithPopup: vi.fn(),
    signInWithRedirect: vi.fn(),
    signOut: vi.fn()
  },
  firebaseServicesMock: {
    isConfigured: true,
    auth: { kind: "auth" } as { kind: string } | null,
    googleProvider: { providerId: "google.com" } as { providerId: string } | null,
    configuredAuthDomain: "spectus-33cfe.firebaseapp.com"
  }
}));

vi.mock("firebase/auth", () => authModuleMock);
vi.mock("../../infrastructure/firebase/client", () => ({
  firebaseServices: firebaseServicesMock
}));
vi.mock("./authFlow", async () => {
  const actual = await vi.importActual<typeof import("./authFlow")>("./authFlow");

  return {
    ...actual,
    buildFirebaseAppHandoffUrl: vi.fn(actual.buildFirebaseAppHandoffUrl),
    navigateToUrl: vi.fn(actual.navigateToUrl),
    needsFirebaseAppDomainHandoff: vi.fn(actual.needsFirebaseAppDomainHandoff),
    shouldPreferPopupAuth: vi.fn(actual.shouldPreferPopupAuth),
    stripAutoStartParamFromUrl: vi.fn(actual.stripAutoStartParamFromUrl)
  };
});

import { AuthProvider, useAuthSession } from "./AuthProvider";
import {
  AUTO_START_PARAM,
  buildFirebaseAppHandoffUrl,
  HANDOFF_MARKER_KEY,
  INIT_TIMEOUT_MS,
  navigateToUrl,
  needsFirebaseAppDomainHandoff,
  REDIRECT_MARKER_KEY,
  shouldPreferPopupAuth,
  stripAutoStartParamFromUrl
} from "./authFlow";

function setUrl(url: string) {
  window.history.replaceState({}, "", url);
}

function flushMicrotasks() {
  return act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

function AuthProbe() {
  const auth = useAuthSession();

  return (
    <>
      <div data-testid="status">{auth.status}</div>
      <div data-testid="configured">{String(auth.isConfigured)}</div>
      <div data-testid="authenticating">{String(auth.isAuthenticating)}</div>
      <div data-testid="error">{auth.error ?? ""}</div>
      <div data-testid="user">{auth.user?.uid ?? ""}</div>
      <button onClick={() => void auth.signInWithGoogle()}>sign-in</button>
      <button onClick={() => void auth.signOutFromWorkspace()}>sign-out</button>
    </>
  );
}

describe("AuthProvider", () => {
  let authStateListener: ((user: User | null) => void) | undefined;
  let authStateErrorListener: ((error: unknown) => void) | undefined;
  const unsubscribeSpy = vi.fn();

  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    window.sessionStorage.clear();
    setUrl("/");

    firebaseServicesMock.isConfigured = true;
    firebaseServicesMock.auth = { kind: "auth" };
    firebaseServicesMock.googleProvider = { providerId: "google.com" };
    firebaseServicesMock.configuredAuthDomain = "spectus-33cfe.firebaseapp.com";

    authStateListener = undefined;
    authStateErrorListener = undefined;
    unsubscribeSpy.mockReset();

    authModuleMock.setPersistence.mockResolvedValue(undefined);
    authModuleMock.signInWithPopup.mockResolvedValue({ user: { uid: "popup-user" } });
    authModuleMock.signInWithRedirect.mockResolvedValue(undefined);
    authModuleMock.signOut.mockResolvedValue(undefined);
    authModuleMock.onAuthStateChanged.mockImplementation(
      (_auth: unknown, onNext: (user: User | null) => void, onError?: (error: unknown) => void) => {
        authStateListener = onNext;
        authStateErrorListener = onError;
        return unsubscribeSpy;
      }
    );

    vi.mocked(needsFirebaseAppDomainHandoff).mockImplementation((configuredAuthDomain?: string) => {
      const domain = configuredAuthDomain ?? firebaseServicesMock.configuredAuthDomain;
      return (
        window.location.host.endsWith(".web.app") &&
        Boolean(domain) &&
        domain.endsWith(".firebaseapp.com") &&
        window.location.host !== domain
      );
    });
    vi.mocked(buildFirebaseAppHandoffUrl).mockImplementation((configuredAuthDomain?: string) => {
      const domain = configuredAuthDomain ?? firebaseServicesMock.configuredAuthDomain;
      if (!domain) {
        return null;
      }

      const url = new URL(window.location.href);
      url.host = domain;
      url.searchParams.set(AUTO_START_PARAM, "1");
      return url.toString();
    });
    vi.mocked(stripAutoStartParamFromUrl).mockImplementation(() => {
      const url = new URL(window.location.href);
      if (!url.searchParams.has(AUTO_START_PARAM)) {
        return false;
      }

      url.searchParams.delete(AUTO_START_PARAM);
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
      return true;
    });
    vi.mocked(navigateToUrl).mockImplementation(() => {});
    vi.mocked(shouldPreferPopupAuth).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    window.sessionStorage.clear();
    setUrl("/");
  });

  it("requires a provider for useAuthSession", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useAuthSession())).toThrow(
      "useAuthSession must be used inside AuthProvider"
    );

    consoleErrorSpy.mockRestore();
  });

  it("stays disabled without configured firebase auth", async () => {
    firebaseServicesMock.isConfigured = false;
    firebaseServicesMock.auth = null;
    firebaseServicesMock.googleProvider = null;

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    expect(screen.getByTestId("status")).toHaveTextContent("disabled");
    expect(screen.getByTestId("configured")).toHaveTextContent("false");

    fireEvent.click(screen.getByText("sign-in"));
    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("Firebase auth is not configured");
    });

    fireEvent.click(screen.getByText("sign-out"));
    expect(authModuleMock.signOut).not.toHaveBeenCalled();
    expect(authModuleMock.onAuthStateChanged).not.toHaveBeenCalled();
  });

  it("subscribes to auth state and resolves into a signed-in session", async () => {
    window.sessionStorage.setItem(REDIRECT_MARKER_KEY, "1");
    window.sessionStorage.setItem(HANDOFF_MARKER_KEY, "1");

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(authModuleMock.onAuthStateChanged).toHaveBeenCalledOnce());

    await act(async () => {
      authStateListener?.({ uid: "user-1" } as User);
    });

    expect(screen.getByTestId("status")).toHaveTextContent("signed-in");
    expect(screen.getByTestId("user")).toHaveTextContent("user-1");
    expect(screen.getByTestId("authenticating")).toHaveTextContent("false");
    expect(window.sessionStorage.getItem(REDIRECT_MARKER_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(HANDOFF_MARKER_KEY)).toBeNull();
  });

  it("resolves into a signed-out session when no user is returned", async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(authModuleMock.onAuthStateChanged).toHaveBeenCalledOnce());

    await act(async () => {
      authStateListener?.(null);
    });

    expect(screen.getByTestId("status")).toHaveTextContent("signed-out");
    expect(screen.getByTestId("user")).toHaveTextContent("");
  });

  it("surfaces auth state errors", async () => {
    window.sessionStorage.setItem(REDIRECT_MARKER_KEY, "1");
    window.sessionStorage.setItem(HANDOFF_MARKER_KEY, "1");

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(authModuleMock.onAuthStateChanged).toHaveBeenCalledOnce());

    await act(async () => {
      authStateErrorListener?.("not-an-error");
    });

    expect(screen.getByTestId("status")).toHaveTextContent("signed-out");
    expect(screen.getByTestId("error")).toHaveTextContent("Auth state error");
    expect(window.sessionStorage.getItem(REDIRECT_MARKER_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(HANDOFF_MARKER_KEY)).toBeNull();
  });

  it("falls back to signed-out after the init timeout", async () => {
    vi.useFakeTimers();
    window.sessionStorage.setItem(REDIRECT_MARKER_KEY, "1");

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    expect(screen.getByTestId("authenticating")).toHaveTextContent("true");

    await act(async () => {
      vi.advanceTimersByTime(INIT_TIMEOUT_MS);
    });

    expect(screen.getByTestId("status")).toHaveTextContent("signed-out");
    expect(screen.getByTestId("authenticating")).toHaveTextContent("false");
    expect(window.sessionStorage.getItem(REDIRECT_MARKER_KEY)).toBeNull();
  });

  it("keeps redirect auth pending when Firebase reports no user yet", async () => {
    window.sessionStorage.setItem(REDIRECT_MARKER_KEY, "1");

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(authModuleMock.onAuthStateChanged).toHaveBeenCalledOnce());

    await act(async () => {
      authStateListener?.(null);
    });

    expect(screen.getByTestId("status")).toHaveTextContent("loading");
    expect(screen.getByTestId("authenticating")).toHaveTextContent("true");
    expect(window.sessionStorage.getItem(REDIRECT_MARKER_KEY)).toBe("1");
  });

  it("ignores delayed callbacks after the provider unmounts", async () => {
    const persistenceDeferred = deferred<void>();
    authModuleMock.setPersistence.mockReturnValueOnce(persistenceDeferred.promise);

    let scheduledTimeout: (() => void) | undefined;
    const setTimeoutSpy = vi
      .spyOn(window, "setTimeout")
      .mockImplementation(((callback: TimerHandler) => {
        scheduledTimeout = callback as () => void;
        return 1 as unknown as number;
      }) as typeof window.setTimeout);

    const view = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    expect(authModuleMock.onAuthStateChanged).toHaveBeenCalledOnce();
    expect(setTimeoutSpy).toHaveBeenCalledOnce();

    view.unmount();

    await act(async () => {
      authStateListener?.({ uid: "late-user" } as User);
      authStateErrorListener?.(new Error("late-error"));
      persistenceDeferred.reject(new Error("late-persistence"));
      scheduledTimeout?.();
      await Promise.resolve();
    });

    expect(unsubscribeSpy).toHaveBeenCalledOnce();
  });

  it("shows persistence setup errors while mounted", async () => {
    authModuleMock.setPersistence.mockRejectedValueOnce(new Error("persist failed"));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("persist failed");
    });
  });

  it("auto-starts redirect auth from the firebase handoff url", async () => {
    setUrl(`/?${AUTO_START_PARAM}=1`);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(authModuleMock.signInWithRedirect).toHaveBeenCalledOnce());

    expect(window.location.search).toBe("");
    expect(window.sessionStorage.getItem(HANDOFF_MARKER_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(REDIRECT_MARKER_KEY)).toBe("1");
  });

  it("does not auto-start redirect twice when a redirect marker already exists", async () => {
    setUrl(`/?${AUTO_START_PARAM}=1`);
    window.sessionStorage.setItem(REDIRECT_MARKER_KEY, "1");

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(authModuleMock.onAuthStateChanged).toHaveBeenCalledOnce());

    expect(authModuleMock.signInWithRedirect).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });

  it("surfaces redirect autostart failures while mounted", async () => {
    setUrl(`/?${AUTO_START_PARAM}=1`);
    authModuleMock.signInWithRedirect.mockRejectedValueOnce("redirect failed");

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("Google redirect sign-in failed");
    });

    expect(screen.getByTestId("status")).toHaveTextContent("signed-out");
    expect(window.sessionStorage.getItem(REDIRECT_MARKER_KEY)).toBeNull();
  });

  it("ignores redirect autostart failures after unmount", async () => {
    setUrl(`/?${AUTO_START_PARAM}=1`);
    const redirectDeferred = deferred<void>();
    authModuleMock.signInWithRedirect.mockReturnValueOnce(redirectDeferred.promise);

    const view = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(authModuleMock.signInWithRedirect).toHaveBeenCalledOnce());
    view.unmount();

    redirectDeferred.reject(new Error("late redirect failure"));
    await flushMicrotasks();

    expect(unsubscribeSpy).toHaveBeenCalledOnce();
  });

  it("starts a same-tab handoff when auth must move to firebaseapp.com", async () => {
    vi.mocked(needsFirebaseAppDomainHandoff).mockReturnValue(true);
    vi.mocked(buildFirebaseAppHandoffUrl).mockReturnValue(
      "https://spectus-33cfe.firebaseapp.com/?authStart=1"
    );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(authModuleMock.onAuthStateChanged).toHaveBeenCalledOnce());
    authModuleMock.setPersistence.mockClear();
    authModuleMock.signInWithRedirect.mockClear();

    fireEvent.click(screen.getByText("sign-in"));

    await waitFor(() => {
      expect(navigateToUrl).toHaveBeenCalledWith(
        "https://spectus-33cfe.firebaseapp.com/?authStart=1"
      );
    });

    expect(window.sessionStorage.getItem(HANDOFF_MARKER_KEY)).toBe("1");
    expect(authModuleMock.signInWithRedirect).not.toHaveBeenCalled();
  });

  it("shows an error when the handoff url cannot be built", async () => {
    vi.mocked(needsFirebaseAppDomainHandoff).mockReturnValue(true);
    vi.mocked(buildFirebaseAppHandoffUrl).mockReturnValue(null);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(authModuleMock.onAuthStateChanged).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByText("sign-in"));

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent(
        "Could not build the Firebase authentication URL"
      );
    });
    expect(screen.getByTestId("authenticating")).toHaveTextContent("false");
  });

  it("ignores sign-in requests while authentication is already in progress", async () => {
    window.sessionStorage.setItem(REDIRECT_MARKER_KEY, "1");

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(authModuleMock.onAuthStateChanged).toHaveBeenCalledOnce());
    authModuleMock.setPersistence.mockClear();
    authModuleMock.signInWithRedirect.mockClear();

    fireEvent.click(screen.getByText("sign-in"));

    expect(authModuleMock.setPersistence).not.toHaveBeenCalled();
    expect(authModuleMock.signInWithRedirect).not.toHaveBeenCalled();
  });

  it("starts google popup auth when popup auth is preferred", async () => {
    vi.mocked(shouldPreferPopupAuth).mockReturnValue(true);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(authModuleMock.onAuthStateChanged).toHaveBeenCalledOnce());
    authModuleMock.setPersistence.mockClear();
    authModuleMock.signInWithPopup.mockClear();

    fireEvent.click(screen.getByText("sign-in"));

    await waitFor(() => {
      expect(authModuleMock.setPersistence).toHaveBeenCalledWith(
        firebaseServicesMock.auth,
        authModuleMock.browserLocalPersistence
      );
      expect(authModuleMock.signInWithPopup).toHaveBeenCalledWith(
        firebaseServicesMock.auth,
        firebaseServicesMock.googleProvider
      );
    });

    expect(screen.getByTestId("status")).toHaveTextContent("signed-in");
    expect(screen.getByTestId("user")).toHaveTextContent("popup-user");
    expect(window.sessionStorage.getItem(REDIRECT_MARKER_KEY)).toBeNull();
  });

  it("falls back to redirect auth when the popup is blocked", async () => {
    vi.mocked(shouldPreferPopupAuth).mockReturnValue(true);
    authModuleMock.signInWithPopup.mockRejectedValueOnce(
      Object.assign(new Error("popup blocked"), { code: "auth/popup-blocked" })
    );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(authModuleMock.onAuthStateChanged).toHaveBeenCalledOnce());
    authModuleMock.setPersistence.mockClear();
    authModuleMock.signInWithPopup.mockClear();
    authModuleMock.signInWithRedirect.mockClear();

    fireEvent.click(screen.getByText("sign-in"));

    await waitFor(() => {
      expect(authModuleMock.signInWithPopup).toHaveBeenCalledOnce();
      expect(authModuleMock.signInWithRedirect).toHaveBeenCalledWith(
        firebaseServicesMock.auth,
        firebaseServicesMock.googleProvider
      );
    });

    expect(window.sessionStorage.getItem(REDIRECT_MARKER_KEY)).toBe("1");
  });

  it("shows popup sign-in errors when popup auth fails", async () => {
    vi.mocked(shouldPreferPopupAuth).mockReturnValue(true);
    authModuleMock.signInWithPopup.mockRejectedValueOnce(new Error("popup failed"));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(authModuleMock.onAuthStateChanged).toHaveBeenCalledOnce());
    authModuleMock.setPersistence.mockClear();
    authModuleMock.signInWithPopup.mockClear();

    fireEvent.click(screen.getByText("sign-in"));

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("popup failed");
    });

    expect(window.sessionStorage.getItem(REDIRECT_MARKER_KEY)).toBeNull();
    expect(screen.getByTestId("authenticating")).toHaveTextContent("false");
  });

  it("starts google redirect auth directly on the firebaseapp domain", async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(authModuleMock.onAuthStateChanged).toHaveBeenCalledOnce());
    authModuleMock.setPersistence.mockClear();
    authModuleMock.signInWithRedirect.mockClear();

    fireEvent.click(screen.getByText("sign-in"));

    await waitFor(() => {
      expect(authModuleMock.setPersistence).toHaveBeenCalledWith(
        firebaseServicesMock.auth,
        authModuleMock.browserLocalPersistence
      );
      expect(authModuleMock.signInWithRedirect).toHaveBeenCalledWith(
        firebaseServicesMock.auth,
        firebaseServicesMock.googleProvider
      );
    });

    expect(window.sessionStorage.getItem(REDIRECT_MARKER_KEY)).toBe("1");
  });

  it("shows redirect sign-in errors on direct sign-in failures", async () => {
    authModuleMock.signInWithRedirect.mockRejectedValueOnce(new Error("direct redirect failed"));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(authModuleMock.onAuthStateChanged).toHaveBeenCalledOnce());
    authModuleMock.setPersistence.mockClear();
    authModuleMock.signInWithRedirect.mockClear();

    fireEvent.click(screen.getByText("sign-in"));

    await waitFor(() => {
      expect(screen.getByTestId("error")).toHaveTextContent("direct redirect failed");
    });

    expect(window.sessionStorage.getItem(REDIRECT_MARKER_KEY)).toBeNull();
    expect(screen.getByTestId("authenticating")).toHaveTextContent("false");
  });

  it("clears auth markers and signs out from the workspace", async () => {
    window.sessionStorage.setItem(REDIRECT_MARKER_KEY, "1");
    window.sessionStorage.setItem(HANDOFF_MARKER_KEY, "1");

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(authModuleMock.onAuthStateChanged).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByText("sign-out"));

    await waitFor(() => {
      expect(authModuleMock.signOut).toHaveBeenCalledWith(firebaseServicesMock.auth);
    });
    expect(window.sessionStorage.getItem(REDIRECT_MARKER_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(HANDOFF_MARKER_KEY)).toBeNull();
  });
});



