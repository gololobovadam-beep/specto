import { describe, expect, it, vi } from "vitest";
import {
  AUTO_START_PARAM,
  buildFirebaseAppHandoffUrl,
  canUseRedirectAuth,
  isStandaloneAuthContext,
  navigateToUrl,
  needsFirebaseAppDomainHandoff,
  readSessionFlag,
  REDIRECT_MARKER_KEY,
  shouldPreferPopupAuth,
  stripAutoStartParamFromUrl,
  toAuthErrorMessage,
  writeSessionFlag
} from "./authFlow";

function createBrowserWindow(
  url: string,
  {
    userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    standalone = false,
    standaloneDisplayMode = false
  }: {
    userAgent?: string;
    standalone?: boolean;
    standaloneDisplayMode?: boolean;
  } = {}
) {
  const location = new URL(url);
  const sessionStorage = {
    store: new Map<string, string>(),
    getItem(key: string) {
      return this.store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      this.store.set(key, value);
    },
    removeItem(key: string) {
      this.store.delete(key);
    },
    clear() {
      this.store.clear();
    }
  };
  const history = {
    replaceState: vi.fn((_state: unknown, _title: string, nextUrl: string) => {
      const nextLocation = new URL(nextUrl);
      location.href = nextLocation.href;
    })
  };
  const assign = vi.fn((nextUrl: string) => {
    location.href = nextUrl;
  });
  const matchMedia = vi.fn((query: string) => ({
    matches: query === "(display-mode: standalone)" ? standaloneDisplayMode : false
  }));

  return {
    history: history as unknown as Window["history"],
    location: Object.assign(location, { assign }) as unknown as Window["location"],
    matchMedia: matchMedia as unknown as Window["matchMedia"],
    navigator: {
      userAgent,
      standalone
    } as Navigator & { standalone?: boolean },
    sessionStorage: sessionStorage as unknown as Window["sessionStorage"]
  };
}

describe("authFlow", () => {
  it("reads and writes session flags", () => {
    const browserWindow = createBrowserWindow("https://spectus-33cfe.firebaseapp.com/");

    expect(readSessionFlag(REDIRECT_MARKER_KEY, browserWindow)).toBe(false);

    writeSessionFlag(REDIRECT_MARKER_KEY, true, browserWindow);
    expect(readSessionFlag(REDIRECT_MARKER_KEY, browserWindow)).toBe(true);

    writeSessionFlag(REDIRECT_MARKER_KEY, false, browserWindow);
    expect(readSessionFlag(REDIRECT_MARKER_KEY, browserWindow)).toBe(false);
  });

  it("returns safe defaults when a browser window is explicitly unavailable", () => {
    expect(readSessionFlag(REDIRECT_MARKER_KEY, null)).toBe(false);
    expect(isStandaloneAuthContext(null)).toBe(false);
    expect(canUseRedirectAuth("spectus-33cfe.firebaseapp.com", null)).toBe(false);
    expect(shouldPreferPopupAuth(undefined, null)).toBe(false);
    expect(needsFirebaseAppDomainHandoff("spectus-33cfe.firebaseapp.com", null)).toBe(false);
    expect(buildFirebaseAppHandoffUrl("spectus-33cfe.firebaseapp.com", null)).toBeNull();
    expect(stripAutoStartParamFromUrl(null)).toBe(false);
    expect(() => writeSessionFlag(REDIRECT_MARKER_KEY, true, null)).not.toThrow();
    expect(() => navigateToUrl("https://spectus-33cfe.firebaseapp.com/", null)).not.toThrow();
  });

  it("falls back safely when the global window object is missing", () => {
    vi.stubGlobal("window", undefined);

    expect(readSessionFlag(REDIRECT_MARKER_KEY)).toBe(false);
    expect(canUseRedirectAuth()).toBe(false);
    expect(shouldPreferPopupAuth()).toBe(false);

    vi.unstubAllGlobals();
  });

  it("detects standalone auth contexts from navigator or display mode", () => {
    expect(
      isStandaloneAuthContext(
        createBrowserWindow("https://spectus-33cfe.firebaseapp.com/", { standalone: true })
      )
    ).toBe(true);

    expect(
      isStandaloneAuthContext(
        createBrowserWindow("https://spectus-33cfe.firebaseapp.com/", {
          standaloneDisplayMode: true
        })
      )
    ).toBe(true);
  });

  it("prefers popup auth on desktop and standalone contexts", () => {
    expect(
      shouldPreferPopupAuth(
        "spectus-33cfe.firebaseapp.com",
        createBrowserWindow("https://spectus-33cfe.firebaseapp.com/")
      )
    ).toBe(true);

    expect(
      shouldPreferPopupAuth(
        "spectus-33cfe.firebaseapp.com",
        createBrowserWindow("https://spectus-33cfe.firebaseapp.com/", {
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
        })
      )
    ).toBe(false);

    expect(
      shouldPreferPopupAuth(
        "spectus-33cfe.firebaseapp.com",
        createBrowserWindow("https://spectus-33cfe.firebaseapp.com/", {
          userAgent:
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
          standaloneDisplayMode: true
        })
      )
    ).toBe(true);
  });

  it("prefers popup auth on external hosts where redirect auth would be cross-origin", () => {
    const browserWindow = createBrowserWindow("https://specto.example.com/page", {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
    });

    expect(canUseRedirectAuth("spectus-33cfe.firebaseapp.com", browserWindow)).toBe(false);
    expect(shouldPreferPopupAuth("spectus-33cfe.firebaseapp.com", browserWindow)).toBe(true);
  });

  it("allows redirect auth on localhost and firebase hosting domains", () => {
    expect(
      canUseRedirectAuth(
        "spectus-33cfe.firebaseapp.com",
        createBrowserWindow("http://localhost:5173/")
      )
    ).toBe(true);

    expect(
      canUseRedirectAuth(
        "spectus-33cfe.firebaseapp.com",
        createBrowserWindow("https://spectus-33cfe.web.app/page")
      )
    ).toBe(true);
  });

  it("detects when firebaseapp handoff is required", () => {
    const browserWindow = createBrowserWindow("https://spectus-33cfe.web.app/page");

    expect(
      needsFirebaseAppDomainHandoff("spectus-33cfe.firebaseapp.com", browserWindow)
    ).toBe(true);
  });

  it("does not require handoff when auth domain is missing or already matches", () => {
    const webAppWindow = createBrowserWindow("https://spectus-33cfe.web.app/page");
    expect(needsFirebaseAppDomainHandoff("", webAppWindow)).toBe(false);

    const firebaseWindow = createBrowserWindow("https://spectus-33cfe.firebaseapp.com/page");
    expect(
      needsFirebaseAppDomainHandoff("spectus-33cfe.firebaseapp.com", firebaseWindow)
    ).toBe(false);
  });

  it("does not require handoff on non-web-app domains or non-firebase auth domains", () => {
    const customDomainWindow = createBrowserWindow("https://example.com/page");
    expect(
      needsFirebaseAppDomainHandoff("spectus-33cfe.firebaseapp.com", customDomainWindow)
    ).toBe(false);

    const webAppWindow = createBrowserWindow("https://spectus-33cfe.web.app/page");
    expect(needsFirebaseAppDomainHandoff("spectus-33cfe.web.app", webAppWindow)).toBe(false);
  });

  it("builds a firebaseapp handoff url and preserves existing params", () => {
    const browserWindow = createBrowserWindow("https://spectus-33cfe.web.app/page?mode=edit");

    expect(buildFirebaseAppHandoffUrl("spectus-33cfe.firebaseapp.com", browserWindow)).toBe(
      "https://spectus-33cfe.firebaseapp.com/page?mode=edit&authStart=1"
    );
  });

  it("returns null when handoff url cannot be built without an auth domain", () => {
    const browserWindow = createBrowserWindow("https://spectus-33cfe.web.app/page?mode=edit");

    expect(buildFirebaseAppHandoffUrl("", browserWindow)).toBeNull();
  });

  it("strips the autostart query param when present", () => {
    const browserWindow = createBrowserWindow(
      `https://spectus-33cfe.firebaseapp.com/page?${AUTO_START_PARAM}=1&mode=edit`
    );

    expect(stripAutoStartParamFromUrl(browserWindow)).toBe(true);
    expect(browserWindow.location.search).toBe("?mode=edit");
    expect(browserWindow.history.replaceState).toHaveBeenCalledWith(
      {},
      "",
      "https://spectus-33cfe.firebaseapp.com/page?mode=edit"
    );
  });

  it("does nothing when the autostart query param is absent", () => {
    const browserWindow = createBrowserWindow("https://spectus-33cfe.firebaseapp.com/page?mode=edit");

    expect(stripAutoStartParamFromUrl(browserWindow)).toBe(false);
    expect(browserWindow.location.search).toBe("?mode=edit");
  });

  it("navigates to a handoff url when a browser window is available", () => {
    const browserWindow = createBrowserWindow("https://spectus-33cfe.firebaseapp.com/");

    navigateToUrl("https://spectus-33cfe.firebaseapp.com/?authStart=1", browserWindow);

    expect(browserWindow.location.assign).toHaveBeenCalledWith(
      "https://spectus-33cfe.firebaseapp.com/?authStart=1"
    );
  });

  it("normalizes unknown auth errors to a fallback message", () => {
    expect(toAuthErrorMessage(new Error("boom"), "fallback")).toBe("boom");
    expect(toAuthErrorMessage("boom", "fallback")).toBe("fallback");
  });
});
