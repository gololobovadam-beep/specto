import type { AppSession, PageCardSettings, UserSettings } from "./models";

export const SCHEMA_VERSION = 1;

export function createDefaultSession(): AppSession {
  return {
    openTabs: [],
    activeTabId: null,
    lastOpenedHub: true,
    pageUiStateByPageId: {},
    schemaVersion: SCHEMA_VERSION
  };
}

export function createDefaultSettings(): UserSettings {
  return {
    darkTheme: false,
    compactDensity: false,
    reducedMotion: false,
    showTopicCounters: true,
    futureCloudSyncEnabled: false,
    futureImportEnabled: false
  };
}

export function normalizeUserSettings(settings?: Partial<UserSettings> | null): UserSettings {
  return {
    ...createDefaultSettings(),
    ...(settings ?? {})
  };
}

export function createDefaultPageCardSettings(): PageCardSettings {
  return {
    minWidthPx: 240,
    titleFontSizePx: 18,
    titleLines: 4,
    showPreviewContent: true,
    previewLines: 3
  };
}
