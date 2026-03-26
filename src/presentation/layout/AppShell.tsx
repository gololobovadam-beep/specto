import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import type { PageCardSettings, PageEntity, UserSettings } from "../../domain/models";
import { useAuthSession } from "../auth/AuthProvider";
import { ActionButton, FieldLabel, OverlayPanel, ToggleRow } from "../components/common";
import { PagesHubScreen } from "../screens/PagesHubScreen";
import { PageScreen } from "../screens/PageScreen";
import { useWorkspace } from "../state/WorkspaceProvider";

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuthSession();
  const {
    snapshot,
    isLoading,
    error,
    storageKind,
    openPageTab,
    closeTab,
    showPagesHub,
    updateSettings,
    updatePageCardSettings
  } = useWorkspace();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(snapshot.settings);
  const [pageCardSettingsDrafts, setPageCardSettingsDrafts] = useState<Record<string, PageCardSettings>>({});
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const didRestoreRef = useRef(false);

  const openTabs = useMemo(
    () =>
      snapshot.session.openTabs.flatMap((tab) => {
        const page = snapshot.pages.find((item) => item.id === tab.pageId && !item.deletedAt);
        return page ? [{ ...tab, page }] : [];
      }),
    [snapshot.pages, snapshot.session.openTabs]
  );
  const visiblePages = useMemo(
    () => snapshot.pages.filter((page) => !page.deletedAt),
    [snapshot.pages]
  );

  const activePageId = getActivePageId(location.pathname);

  useEffect(() => {
    didRestoreRef.current = false;
  }, [auth.user?.uid]);

  useEffect(() => {
    const theme = snapshot.settings.darkTheme ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0f1419" : "#ffffff");
  }, [snapshot.settings.darkTheme]);

  useEffect(() => {
    if (isLoading || didRestoreRef.current || auth.status !== "signed-in") {
      return;
    }

    didRestoreRef.current = true;
    if (location.pathname !== "/") {
      return;
    }

    if (snapshot.session.activeTabId && !snapshot.session.lastOpenedHub) {
      navigate(`/pages/${snapshot.session.activeTabId}`, { replace: true });
    }
  }, [auth.status, isLoading, location.pathname, navigate, snapshot.session.activeTabId, snapshot.session.lastOpenedHub]);

  async function handleSelectTab(pageId: string) {
    await openPageTab(pageId);
    navigate(`/pages/${pageId}`);
  }

  async function handleCloseTab(pageId: string) {
    if (activePageId === pageId) {
      const remainingTabs = openTabs.filter((tab) => tab.pageId !== pageId);
      const fallbackPageId = remainingTabs.at(-1)?.pageId ?? null;
      navigate(fallbackPageId ? `/pages/${fallbackPageId}` : "/");
    }

    await closeTab(pageId);
  }

  async function handleOpenHub() {
    await showPagesHub();
    navigate("/");
  }

  function handleOpenSettings() {
    setSettingsDraft({ ...snapshot.settings });
    setPageCardSettingsDrafts(createPageCardSettingsDrafts(visiblePages));
    setSettingsOpen(true);
  }

  function handleCloseSettings() {
    if (isSavingSettings) {
      return;
    }

    setSettingsOpen(false);
  }

  async function handleSaveSettings() {
    if (isSavingSettings) {
      return;
    }

    setIsSavingSettings(true);

    try {
      if (!areUserSettingsEqual(snapshot.settings, settingsDraft)) {
        await updateSettings(settingsDraft);
      }

      for (const page of visiblePages) {
        const nextCardSettings = pageCardSettingsDrafts[page.id] ?? page.cardSettings;
        if (!arePageCardSettingsEqual(page.cardSettings, nextCardSettings)) {
          await updatePageCardSettings(page.id, nextCardSettings);
        }
      }

      setSettingsOpen(false);
    } finally {
      setIsSavingSettings(false);
    }
  }

  if (!auth.isConfigured) {
    return (
      <BootstrapShell>
        <section className="hero-card">
          <p className="eyebrow">Sync required</p>
          <h1>Firebase configuration is missing</h1>
          <p className="section-copy">
            To keep pages and topics safe across devices, add your Firebase web config to a local `.env` file.
          </p>
          <pre className="inline-code-block">VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...</pre>
          <p className="section-copy">
            After that, restart the dev server or rebuild the app and sign in with Google.
          </p>
        </section>
      </BootstrapShell>
    );
  }

  if (auth.status === "loading") {
    return (
      <BootstrapShell>
        <section className="hero-card hero-card--loading">
          <div className="loading-state__card">Connecting to Firebase...</div>
        </section>
      </BootstrapShell>
    );
  }

  if (auth.status === "signed-out") {
    return (
      <BootstrapShell>
        <section className="hero-card hero-card--auth">
          <h1>Authorization via Google</h1>
          {auth.error ? <div className="error-banner error-banner--inline">{auth.error}</div> : null}
          <div className="hero-actions hero-actions--center">
            <ActionButton
              type="button"
              variant="primary"
              className="button--google"
              onClick={() => auth.signInWithGoogle()}
              disabled={auth.isAuthenticating}
            >
              <img src="/google.webp" alt="" aria-hidden="true" className="button__icon button__icon--google" />
              <span>{auth.isAuthenticating ? "Opening Google..." : "Sign in with Google"}</span>
            </ActionButton>
          </div>
        </section>
      </BootstrapShell>
    );
  }

  return (
    <div
      className={[
        "app-shell",
        snapshot.settings.compactDensity ? "app-shell--compact" : "",
        snapshot.settings.reducedMotion ? "app-shell--reduced-motion" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className="app-header">
        <div className="tab-strip" role="tablist" aria-label="Open pages tabs">
          {openTabs.map((tab) => (
            <div key={tab.pageId} className={`tab ${activePageId === tab.pageId ? "tab--active" : ""}`.trim()}>
              <button
                type="button"
                className="tab__select"
                role="tab"
                aria-selected={activePageId === tab.pageId}
                onClick={() => handleSelectTab(tab.pageId)}
              >
                <span className="tab__label">{tab.label}</span>
              </button>
              <button
                type="button"
                className="tab__close"
                aria-label={`Close ${tab.label}`}
                onClick={() => {
                  void handleCloseTab(tab.pageId);
                }}
              >
                x
              </button>
            </div>
          ))}
          <button type="button" className="tab tab--add" onClick={handleOpenHub} aria-label="Open pages hub">
            +
          </button>
        </div>
        <button
          type="button"
          className="icon-button icon-button--gear"
          onClick={handleOpenSettings}
          aria-label="Open settings"
        >
          <img src="/settings.png" alt="" aria-hidden="true" className="icon-button__image" />
        </button>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <main className="app-main">
        {isLoading ? (
          <section className="loading-state">
            <div className="loading-state__card">Loading workspace...</div>
          </section>
        ) : (
          <Routes>
            <Route path="/" element={<PagesHubScreen />} />
            <Route path="/pages/:pageId" element={<PageScreen />} />
            <Route path="/pages/:pageId/topics/:topicId" element={<PageScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>

      <OverlayPanel
        open={settingsOpen}
        title="Settings"
        subtitle="Workspace preferences"
        onClose={handleCloseSettings}
        className="overlay__panel--wide"
        closeLabel={isSavingSettings ? null : undefined}
      >
        <div className="settings-stack">
          <div className="settings-account">
            <div>
              <strong>{auth.user?.displayName ?? auth.user?.email ?? "Workspace account"}</strong>
              <p>{auth.user?.email ?? "Authenticated with Google"}</p>
            </div>
            <div className="settings-account__meta">
              <span className="soft-badge">{storageKind === "firebase" ? "Synced" : "Local"}</span>
            </div>
          </div>
          <ToggleRow
            label="Dark theme"
            description="Use a darker palette across the workspace."
            checked={settingsDraft.darkTheme}
            onChange={(checked) => setSettingsDraft((current) => ({ ...current, darkTheme: checked }))}
          />
          <ToggleRow
            label="Compact density"
            description="Reduce spacing in cards and lists."
            checked={settingsDraft.compactDensity}
            onChange={(checked) => setSettingsDraft((current) => ({ ...current, compactDensity: checked }))}
          />
          <ToggleRow
            label="Reduced motion"
            description="Use calmer transitions throughout the interface."
            checked={settingsDraft.reducedMotion}
            onChange={(checked) => setSettingsDraft((current) => ({ ...current, reducedMotion: checked }))}
          />
          <ToggleRow
            label="Show topic counters"
            description="Display the topic count in page cards on the hub."
            checked={settingsDraft.showTopicCounters}
            onChange={(checked) => setSettingsDraft((current) => ({ ...current, showTopicCounters: checked }))}
          />

          <section className="settings-section">
            <div className="settings-section__header">
              <h3>Page card settings</h3>
              <p>Each page stores its own topic card layout preferences.</p>
            </div>
            {visiblePages.length === 0 ? (
              <p className="section-copy">Create a page first to configure its topic cards.</p>
            ) : (
              <div className="page-settings-list">
                {visiblePages.map((page) => (
                  <PageCardSettingsPanel
                    key={page.id}
                    page={page}
                    cardSettings={pageCardSettingsDrafts[page.id] ?? page.cardSettings}
                    onPatch={(patch) => {
                      setPageCardSettingsDrafts((current) => ({
                        ...current,
                        [page.id]: {
                          ...(current[page.id] ?? page.cardSettings),
                          ...patch
                        }
                      }));
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          <div className="form-actions form-actions--inline settings-actions">
            <ActionButton type="button" onClick={() => auth.signOutFromWorkspace()} disabled={isSavingSettings}>
              Sign out
            </ActionButton>
            <ActionButton type="button" variant="primary" onClick={() => void handleSaveSettings()} disabled={isSavingSettings}>
              {isSavingSettings ? "Saving..." : "Save"}
            </ActionButton>
          </div>
        </div>
      </OverlayPanel>
    </div>
  );
}

function BootstrapShell({ children }: { children: ReactNode }) {
  return <div className="app-shell app-shell--bootstrap">{children}</div>;
}

function PageCardSettingsPanel({
  page,
  cardSettings,
  onPatch
}: {
  page: PageEntity;
  cardSettings: PageCardSettings;
  onPatch: (patch: Partial<PageCardSettings>) => void;
}) {
  return (
    <article className="page-settings-card">
      <div className="page-settings-card__header">
        <div>
          <strong>{page.title}</strong>
        </div>
      </div>
      <div className="page-settings-grid">
        <PageSettingNumberField
          label="Card width"
          min={70}
          max={480}
          step={10}
          value={cardSettings.minWidthPx}
          onCommit={(value) => onPatch({ minWidthPx: value })}
        />
        <PageSettingNumberField
          label="Card title size"
          min={6}
          max={30}
          step={1}
          value={cardSettings.titleFontSizePx}
          onCommit={(value) => onPatch({ titleFontSizePx: value })}
        />
        <PageSettingNumberField
          label="Title lines"
          min={1}
          max={12}
          step={1}
          value={cardSettings.titleLines}
          onCommit={(value) => onPatch({ titleLines: value })}
        />
      </div>
      <div className="page-settings-preview">
        <ToggleRow
          label="Show preview content"
          description="Show title only or title with preview text."
          checked={cardSettings.showPreviewContent}
          onChange={(checked) => onPatch({ showPreviewContent: checked })}
        />
        <PageSettingNumberField
          label="Preview lines"
          min={1}
          max={12}
          step={1}
          value={cardSettings.previewLines}
          disabled={!cardSettings.showPreviewContent}
          onCommit={(value) => onPatch({ previewLines: value })}
        />
      </div>
    </article>
  );
}

function PageSettingNumberField({
  label,
  description,
  value,
  min,
  max,
  step,
  disabled = false,
  onCommit
}: {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit() {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }

    const nextValue = Math.min(max, Math.max(min, Math.round(parsed / step) * step));
    setDraft(String(nextValue));
    if (nextValue !== value) {
      onCommit(nextValue);
    }
  }

  return (
    <FieldLabel label={label}>
      <div className="page-settings-field">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              setDraft(String(value));
              event.currentTarget.blur();
            }
          }}
        />
        {description ? <span className="field__hint">{description}</span> : null}
      </div>
    </FieldLabel>
  );
}

function getActivePageId(pathname: string) {
  const match = pathname.match(/^\/pages\/([^/]+)/);
  return match?.[1] ?? null;
}

function createPageCardSettingsDrafts(pages: PageEntity[]) {
  return Object.fromEntries(pages.map((page) => [page.id, { ...page.cardSettings }]));
}

function arePageCardSettingsEqual(left: PageCardSettings, right: PageCardSettings) {
  return (
    left.minWidthPx === right.minWidthPx &&
    left.titleFontSizePx === right.titleFontSizePx &&
    left.titleLines === right.titleLines &&
    left.showPreviewContent === right.showPreviewContent &&
    left.previewLines === right.previewLines
  );
}

function areUserSettingsEqual(left: UserSettings, right: UserSettings) {
  return (
    left.darkTheme === right.darkTheme &&
    left.compactDensity === right.compactDensity &&
    left.reducedMotion === right.reducedMotion &&
    left.showTopicCounters === right.showTopicCounters &&
    left.futureCloudSyncEnabled === right.futureCloudSyncEnabled &&
    left.futureImportEnabled === right.futureImportEnabled
  );
}
