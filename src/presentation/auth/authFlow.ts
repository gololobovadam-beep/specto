import { firebaseServices } from "../../infrastructure/firebase/client";

export const REDIRECT_MARKER_KEY = "study-pages.auth.redirect.in-flight";
export const HANDOFF_MARKER_KEY = "study-pages.auth.handoff.pending";
export const AUTO_START_PARAM = "authStart";
export const INIT_TIMEOUT_MS = 8000;

const MOBILE_USER_AGENT_PATTERN =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

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

export function shouldPreferPopupAuth(
  browserWindow: BrowserWindow | null | undefined = getBrowserWindow()
) {
  if (!browserWindow) {
    return false;
  }

  // В standalone (PWA) режиме попапы не работают надёжно
  if (isStandaloneAuthContext(browserWindow)) {
    return false;
  }

  // На десктопе — попап, на мобильном — редирект
  return !MOBILE_USER_AGENT_PATTERN.test(browserWindow.navigator.userAgent ?? "");
}

/**
 * Handoff больше не нужен: authDomain теперь всегда .firebaseapp.com,
 * поэтому переход между .web.app и .firebaseapp.com не требуется.
 * Функция оставлена чтобы не менять сигнатуры, всегда возвращает false.
 */
export function needsFirebaseAppDomainHandoff(
  _configuredAuthDomain = firebaseServices.configuredAuthDomain,
  _browserWindow: BrowserWindow | null | undefined = getBrowserWindow()
) {
  return false;
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
