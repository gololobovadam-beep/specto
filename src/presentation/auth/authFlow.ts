import { firebaseServices } from "../../infrastructure/firebase/client";

export const REDIRECT_MARKER_KEY = "study-pages.auth.redirect.in-flight";
export const HANDOFF_MARKER_KEY = "study-pages.auth.handoff.pending";
export const AUTO_START_PARAM = "authStart";
export const INIT_TIMEOUT_MS = 8000;

const MOBILE_USER_AGENT_PATTERN =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

type BrowserNavigator = Pick<Navigator, "userAgent"> & { standalone?: boolean };
type BrowserWindow = Pick<Window, "history" | "location" | "sessionStorage" | "matchMedia"> & {
  navigator: BrowserNavigator;
};

function getBrowserWindow(): BrowserWindow | undefined {
  return typeof window === "undefined" ? undefined : (window as BrowserWindow);
}

export function readSessionFlag(
  key: string,
  browserWindow: BrowserWindow | null | undefined = getBrowserWindow()
) {
  return browserWindow?.sessionStorage.getItem(key) === "1";
}

export function writeSessionFlag(
  key: string,
  value: boolean,
  browserWindow: BrowserWindow | null | undefined = getBrowserWindow()
) {
  if (!browserWindow) {
    return;
  }

  if (value) {
    browserWindow.sessionStorage.setItem(key, "1");
  } else {
    browserWindow.sessionStorage.removeItem(key);
  }
}

export function isStandaloneAuthContext(
  browserWindow: BrowserWindow | null | undefined = getBrowserWindow()
) {
  if (!browserWindow) {
    return false;
  }

  const navigatorStandalone = Boolean(browserWindow.navigator.standalone);
  const mediaStandalone =
    typeof browserWindow.matchMedia === "function" &&
    browserWindow.matchMedia("(display-mode: standalone)").matches;

  return navigatorStandalone || mediaStandalone;
}

export function isLocalDevelopmentAuthHost(
  browserWindow: BrowserWindow | null | undefined = getBrowserWindow()
) {
  if (!browserWindow) {
    return false;
  }

  return LOCALHOST_HOSTS.has(browserWindow.location.hostname);
}

export function canUseRedirectAuth(
  configuredAuthDomain = firebaseServices.configuredAuthDomain,
  browserWindow: BrowserWindow | null | undefined = getBrowserWindow()
) {
  if (!browserWindow) {
    return false;
  }

  if (isLocalDevelopmentAuthHost(browserWindow)) {
    return true;
  }

  if (!configuredAuthDomain) {
    return false;
  }

  const currentHost = browserWindow.location.host;
  return (
    currentHost === configuredAuthDomain ||
    (currentHost.endsWith(".web.app") && configuredAuthDomain.endsWith(".firebaseapp.com"))
  );
}

export function shouldPreferPopupAuth(
  configuredAuthDomain = firebaseServices.configuredAuthDomain,
  browserWindow: BrowserWindow | null | undefined = getBrowserWindow()
) {
  if (!browserWindow) {
    return false;
  }

  // Keep popup auth in installed PWAs and on external hosts where redirect auth is cross-origin.
  if (isStandaloneAuthContext(browserWindow)) {
    return true;
  }

  if (!canUseRedirectAuth(configuredAuthDomain, browserWindow)) {
    return true;
  }

  // Desktop uses popup by default, mobile can still use redirect when it stays same-origin.
  return !MOBILE_USER_AGENT_PATTERN.test(browserWindow.navigator.userAgent ?? "");
}

/**
 * On some hosts Firebase Auth stays reliable only through the authDomain host,
 * so for `.web.app` we keep a same-tab handoff to `.firebaseapp.com`.
 */
export function needsFirebaseAppDomainHandoff(
  configuredAuthDomain = firebaseServices.configuredAuthDomain,
  browserWindow: BrowserWindow | null | undefined = getBrowserWindow()
) {
  if (!configuredAuthDomain || !browserWindow) {
    return false;
  }

  const currentHost = browserWindow.location.host;
  return (
    currentHost.endsWith(".web.app") &&
    configuredAuthDomain.endsWith(".firebaseapp.com") &&
    currentHost !== configuredAuthDomain
  );
}

export function buildFirebaseAppHandoffUrl(
  configuredAuthDomain = firebaseServices.configuredAuthDomain,
  browserWindow: BrowserWindow | null | undefined = getBrowserWindow()
) {
  if (!configuredAuthDomain || !browserWindow) {
    return null;
  }

  const url = new URL(browserWindow.location.href);
  url.protocol = browserWindow.location.protocol;
  url.host = configuredAuthDomain;
  url.searchParams.set(AUTO_START_PARAM, "1");
  return url.toString();
}

export function stripAutoStartParamFromUrl(
  browserWindow: BrowserWindow | null | undefined = getBrowserWindow()
) {
  if (!browserWindow) {
    return false;
  }

  const url = new URL(browserWindow.location.href);
  if (!url.searchParams.has(AUTO_START_PARAM)) {
    return false;
  }

  url.searchParams.delete(AUTO_START_PARAM);
  browserWindow.history.replaceState({}, "", url.toString());
  return true;
}

export function navigateToUrl(
  url: string,
  browserWindow: BrowserWindow | null | undefined = getBrowserWindow()
) {
  browserWindow?.location.assign(url);
}

export function toAuthErrorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}
