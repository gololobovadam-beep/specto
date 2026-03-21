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
    compactDensity: false,
    reducedMotion: false,
    showTopicCounters: true,
    futureCloudSyncEnabled: false,
    futureImportEnabled: false
  };
}

export function createDefaultPageCardSettings(): PageCardSettings {
  return {
    minWidthPx: 240,
    previewFontSizePx: 14,
    showPreviewContent: true,
    previewLines: 3
  };
}