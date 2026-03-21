# Study Pages App Spec

## 1. Product Direction

Build a personal study-summary application as a `web-first` product with a future path to `Capacitor`.

The app must:

- work first in the browser as a responsive `PWA`;
- later be portable into `iOS` and `Android` shells through `Capacitor`;
- keep the core domain independent from Firebase or any other database;
- feel like a lightweight workspace with tabs, pages, and topic cards;
- stay minimal, fast, and comfortable on mobile and desktop.

Deployment direction for the first release:

- host the web app on `Firebase Hosting`;
- keep storage behind abstractions so the database can be replaced later;
- avoid any design or routing decisions that would block `Capacitor`.


## 2. Core Idea

The app is not a generic note editor.

It is a personal study workspace with:

- a top tab bar;
- a special `Pages Hub` flow for opening or creating pages;
- multiple open page tabs at once;
- each page containing a set of study topics;
- each topic opening into a detail view;
- full persistence of open tabs, ordering, and layout preferences.

The user experience should feel closer to a clean browser/notebook hybrid than to a dashboard or CMS.


## 3. Mandatory Product Principles

1. Mobile-first. The mobile experience is a first-class target, not a fallback.
2. Calm interface. Reading and navigation matter more than decorative controls.
3. Local-first UX. UI state should feel immediate, even when sync exists.
4. Open for extension. The architecture must allow new capabilities without rewriting the foundation.
5. Dependency inversion. Domain and use cases must not depend on Firebase-specific code.
6. One job per layer. UI, domain logic, and storage concerns must stay separated.
7. Predictable state. Tabs, pages, ordering, and settings must persist reliably.


## 4. Platform Strategy

### Phase 1

Build:

- `React`
- `TypeScript`
- `Vite`
- `PWA`
- `Firebase Hosting`

Optional first storage implementation:

- a Firebase-backed adapter;
- or a local adapter during early development;
- but the app code must not be coupled directly to either one.

### Phase 2

Wrap the same web app with `Capacitor` for:

- `App Store`
- `Google Play`

Therefore the app must already be designed for:

- route-based navigation;
- touch-friendly interactions;
- installable shell behavior;
- safe-area support;
- offline-friendly caching;
- no assumptions that only a desktop browser exists.


## 5. Required Tech Direction

Use this stack unless there is a strong reason to change it:

- `React` + `TypeScript`
- `Vite`
- `React Router`
- `dnd-kit` for drag-and-drop
- `Markdown` for topic content
- plain CSS or `CSS Modules` with global design tokens in `:root`

Infrastructure rules:

- UI components must not call Firebase directly.
- Data access must go through repository interfaces.
- App-level services must orchestrate use cases.
- Replaceable storage adapters are mandatory.
- The first deploy target remains `Firebase Hosting`.

Do not:

- hardcode Firestore calls in visual components;
- lock the domain model to one database schema;
- rely on a heavyweight UI framework that forces a generic appearance;
- design navigation in a way that breaks when moved to `Capacitor`.


## 6. Domain Concepts

The following concepts are required and must exist in the architecture.

### Pages Hub

A special screen for:

- showing existing study pages;
- creating a new page;
- reordering pages;
- renaming or soft-deleting pages.

This is the entry point when there are no open tabs.

### Page

A study container with:

- a title;
- its own collection of topics;
- a preferred topic layout mode;
- its own ordering metadata.

### Topic

A study note inside a page.

Each topic contains:

- title;
- optional summary;
- markdown body;
- optional categories;
- manual sort order.

### Tab

A top-level UI state representing an open page.

Tabs are persistent and reopen after app restart.

### Session

The persisted state of:

- open tabs;
- active tab;
- last visited page;
- transient UI preferences that should survive reload.

### Settings

A small settings area with minor features now and room for expansion later.


## 7. Required UX Model

### Initial App Launch

If there are no open tabs and no pages:

- show a clean empty state;
- show text that there are no pages yet;
- show one primary action: `Create new page`.

If there are no open tabs but pages already exist:

- show the `Pages Hub`;
- show the page list;
- show a top action to create a new page.

### Header

The header must contain:

- a horizontal tab strip;
- a `+` button immediately to the right of the last tab;
- a settings button in the top-right corner;
- a clean, minimal visual treatment.

Rules:

- the tab strip must be horizontally scrollable when needed;
- controls must remain usable on mobile;
- the settings button must stay visually secondary to core navigation.

### Plus Button

Pressing `+` opens the `Pages Hub`.

Rules:

- if the `Pages Hub` is already active, do not duplicate it;
- if the user selects an existing page from the hub, open or focus that page tab;
- if the user creates a new page from the hub, the current hub view turns into that page tab.

### Tab Behavior

Tabs represent open pages only.

Rules:

- do not open duplicate tabs for the same page by default;
- switching tabs must preserve the page state;
- open tabs must be restored after refresh or app restart;
- the active tab must also be restored;
- if the last page tab is closed, show the `Pages Hub`.

### Pages Hub List

The `Pages Hub` shows existing pages as reorderable cards or rows.

Each page item must show:

- page title;
- a short preview of the topics it contains;
- a three-dots action button aligned to the right;
- visual affordance that the item can be opened.

The page item menu must contain:

- `Rename page`
- `Soft delete`
- `Show topics as cards`
- `Show topics as list`

These view-mode actions change the preferred topic view for that page.

### Page View

When a page is open:

- the top of the page contains a minimal search field;
- below it is the study content area;
- topics are shown either as cards or as a list, depending on page preference;
- tapping or clicking a topic opens the detail view.

### Topic Detail

On desktop:

- open topic detail in a modal or large dialog.

On mobile:

- open topic detail as a full-screen page or full-screen sheet.

The mobile view must not be a tiny centered modal.


## 8. Functional Scope

### Pages

The app must allow the user to:

- create a new page;
- rename a page;
- soft-delete a page;
- restore a soft-deleted page later if needed;
- reorder pages with drag-and-drop;
- reorder pages with a non-drag fallback;
- set a preferred topic view mode per page.

### Tabs

The app must allow the user to:

- open pages into tabs;
- switch between open tabs;
- close tabs;
- restore the previous tab session after reload.

### Topics

Within a page the app must allow the user to:

- create topics;
- edit topics;
- soft-delete topics;
- duplicate topics;
- reorder topics in cards mode and list mode;
- open topic detail;
- search topics.

### Categories

Categories remain part of the domain.

The app must allow:

- assigning zero or more categories to topics;
- creating categories;
- renaming categories;
- hiding categories if needed.

Categories should be reusable across pages by default.

### Settings

The settings area must exist in the first version.

It should include a mix of:

- small real settings that work now;
- small mock or placeholder items marked as upcoming.

Suggested real settings:

- `Compact density`
- `Reduced motion`
- `Show topic counters`

Suggested placeholder settings:

- `Cloud sync`
- `Import from file`
- `Change storage provider`

Placeholder settings must be visually marked as `Soon` or `Mock`.


## 9. State Persistence Requirements

The following must persist between sessions:

- open tabs;
- active tab;
- page order;
- topic order;
- page view mode;
- created pages;
- created topics;
- selected settings;
- latest page state that the user left open.

Persistence rules:

- the session must survive browser refresh;
- the session must survive closing and reopening the app;
- persistence must be versionable so migrations are possible later;
- persistence logic must be isolated from visual components.


## 10. Architecture Requirements

The architecture must follow layered boundaries.

### Presentation Layer

Responsible for:

- React components;
- routing;
- visual state;
- interaction handling.

Presentation rules:

- components may depend on application services and view models;
- components must not contain direct storage logic;
- components must stay small and composable.

### Application Layer

Responsible for:

- use cases;
- orchestration;
- session restoration;
- page and topic commands;
- search and filtering behavior.

Application rules:

- application services may depend on repository interfaces only;
- business rules belong here or in domain entities, not in UI event handlers;
- each use case should have a single focused responsibility.

### Domain Layer

Responsible for:

- entities;
- value objects;
- domain invariants;
- pure rules around pages, topics, tabs, and ordering.

Domain rules:

- no framework imports;
- no Firebase imports;
- no browser API usage.

### Infrastructure Layer

Responsible for:

- repository implementations;
- Firebase adapter;
- local storage adapter;
- mapping between persistence models and domain models.

Infrastructure rules:

- Firebase must be an adapter, not the center of the app;
- replacing Firebase with another database must not require rewriting the domain or UI;
- infrastructure code may be swapped incrementally.


## 11. SOLID and OOP Rules

These rules are mandatory.

### Single Responsibility

- a component should not manage UI rendering, data storage, and domain rules at once;
- a repository should not also act as a view state container.

### Open/Closed

- adding a new storage provider must not require rewriting the app core;
- adding a new page layout mode should extend behavior, not break existing code.

### Liskov

- storage adapters must behave consistently behind shared interfaces;
- local and Firebase implementations must provide equivalent contract semantics.

### Interface Segregation

- prefer small repository interfaces over one giant storage interface;
- do not force a consumer to depend on page methods when it only needs topic methods.

### Dependency Inversion

- depend on abstractions;
- inject repositories or services into the application layer;
- keep concrete storage setup at the app bootstrap boundary.

### Additional OOP Rules

- entities should own their invariants when practical;
- constructors or factory helpers should prevent invalid states;
- mutation paths must stay explicit and testable.


## 12. Repository Contracts

At minimum, define contracts for:

- `PageRepository`
- `TopicRepository`
- `CategoryRepository`
- `TabSessionRepository`
- `SettingsRepository`

Future-friendly optional contracts:

- `BackupRepository`
- `SyncStatusRepository`

Rules:

- repositories return domain-safe models, not raw Firestore documents;
- mapping code stays inside infrastructure;
- transactions or batched updates should be hidden behind use cases where possible.


## 13. Suggested Domain Model

### Page

- `id: string`
- `title: string`
- `slug: string`
- `preferredViewMode: "grid" | "list"`
- `sortOrder: number`
- `topicIds: string[]`
- `deletedAt: string | null`
- `createdAt: string`
- `updatedAt: string`

### Topic

- `id: string`
- `pageId: string`
- `title: string`
- `summary: string`
- `bodyMarkdown: string`
- `categoryIds: string[]`
- `sortOrder: number`
- `deletedAt: string | null`
- `createdAt: string`
- `updatedAt: string`

### Category

- `id: string`
- `name: string`
- `slug: string`
- `sortOrder: number`
- `isHidden: boolean`
- `createdAt: string`
- `updatedAt: string`

### TabSessionEntry

- `id: string`
- `pageId: string`
- `label: string`
- `openedAt: string`
- `lastVisitedAt: string`

### AppSession

- `openTabs: TabSessionEntry[]`
- `activeTabId: string | null`
- `lastOpenedHub: boolean`
- `schemaVersion: number`

### UserSettings

- `compactDensity: boolean`
- `reducedMotion: boolean`
- `showTopicCounters: boolean`
- `futureCloudSyncEnabled: boolean`
- `futureImportEnabled: boolean`


## 14. Routing Rules

Routing must be compatible with both browser usage and future `Capacitor`.

Suggested routes:

- `/` -> Pages Hub or empty state
- `/pages/:pageId` -> active page content
- `/pages/:pageId/topics/:topicId` -> topic detail
- `/settings` -> settings panel or sheet route if needed

Rules:

- the URL must reflect the active page or topic when practical;
- restoring session state must not break direct-link navigation;
- back navigation must behave naturally on mobile;
- routing must support full-screen topic detail on small screens.


## 15. Responsive Rules

These rules are mandatory.

### General

- mobile-first CSS;
- no horizontal scrolling in normal page content;
- safe-area support for iOS-like devices;
- touch targets at least `44x44px`.

### Header and Tabs

- tabs must remain usable on narrow screens;
- the tab strip may scroll horizontally;
- the `+` button and settings button must stay reachable;
- do not let the header consume too much vertical space on phones.

### Pages Hub

- show pages in one column on phones;
- allow multi-column layout only when space truly exists;
- keep page actions reachable without hover.

### Page Content

- search stays at the top of the content area;
- cards must resize cleanly across breakpoints;
- list mode must remain compact and readable;
- avoid dense enterprise-style tables.

Suggested topic grid:

- `0-699px`: 1 column
- `700-1023px`: 2 columns
- `1024-1399px`: 3 columns
- `1400px+`: 4 columns max

### Topic Detail

- desktop modal or dialog;
- tablet large dialog or sheet;
- phone full-screen route or sheet.


## 16. Drag-and-Drop Rules

Drag-and-drop is required for:

- page ordering in the `Pages Hub`;
- topic ordering inside a page.

Rules:

- drag handles must be visible;
- dragging must work with pointer and touch;
- scrolling must not be broken while not dragging;
- reordering feedback must be visually obvious;
- new order must persist immediately or on explicit confirmation.

Fallback rules:

- provide `Move up` and `Move down` controls;
- drag-and-drop must not be the only way to reorder.

Do not:

- make the entire card draggable if that causes accidental opens;
- hide all reorder affordances behind long-press only;
- depend on hover for essential controls.


## 17. Content Rules

Topic content is stored as `Markdown`.

Supported content:

- headings
- paragraphs
- lists
- inline code
- code blocks
- blockquotes
- links
- tables only if mobile rendering remains acceptable

Rules:

- do not render unsafe raw HTML by default;
- code blocks must not break the layout;
- long content must remain readable on phone screens.


## 18. Visual Direction

Target mood:

- minimal;
- warm;
- editorial;
- quiet;
- slightly tactile.

Do not build a generic admin dashboard.

### Typography

Use:

- `Manrope` for UI;
- `IBM Plex Mono` for code, counters, and technical labels.

### Color Direction

Use CSS variables.

Suggested palette:

- `--bg: #f4efe7`
- `--bg-elevated: #fbf8f2`
- `--surface: rgba(255, 251, 244, 0.88)`
- `--surface-strong: #fffaf3`
- `--text: #181512`
- `--text-muted: #6d665d`
- `--border: rgba(38, 30, 18, 0.1)`
- `--accent: #256b61`
- `--accent-soft: #dcebe7`
- `--danger: #9e4b38`
- `--shadow: 0 10px 30px rgba(30, 24, 16, 0.08)`

Rules:

- avoid purple-first styling;
- avoid pure black on pure white;
- use accent sparingly;
- category colors must remain muted and readable.

### Motion

- transitions around `180ms-240ms`;
- no flashy animation;
- respect `prefers-reduced-motion`.


## 19. Component Requirements

### Empty State

Must contain:

- a clear message that there are no pages yet;
- one primary create button;
- a clean, centered layout.

### Tabs

Must support:

- active state;
- close action;
- overflow scrolling;
- persisted order if tab reordering is later added.

### Page Cards in Pages Hub

Must contain:

- title;
- short topic preview or topic names;
- menu trigger button;
- open interaction;
- optional topic count if enabled in settings.

### Search

Every page view must have:

- a minimal search field;
- instant client-side filtering;
- a clear empty-search result state.

### Topic Cards

Must contain:

- title;
- optional summary;
- category chips if present;
- reorder handle;
- subtle surface depth.

### Settings

Must open from the gear button.

It may be:

- a modal on desktop;
- a sheet or full-screen page on mobile.


## 20. Data and Storage Strategy

The app must support replaceable storage providers.

### Required Approach

- define repository interfaces first;
- implement one concrete provider for the first release;
- keep bootstrap wiring separate from the app core.

### Recommended First Provider Strategy

For the first implementation:

- use Firebase Hosting for deployment;
- optionally use a local provider for fast development;
- prepare a Firebase data provider behind interfaces.

Storage versioning rules:

- persist a schema version;
- support future migrations;
- do not scatter persistence keys across random components.


## 21. Firebase Position in the System

Firebase is an infrastructure concern, not the domain model.

Allowed Firebase roles:

- static hosting;
- optional authentication;
- optional sync storage provider.

Not allowed:

- Firebase-specific entities in the domain layer;
- direct component-to-Firebase coupling;
- assumptions that Firestore is the only possible data source forever.


## 22. PWA and Capacitor Rules

### PWA Requirements

- installable manifest;
- service worker or equivalent caching strategy;
- app shell available offline where practical;
- recently visited content cached when feasible.

### Capacitor Readiness Rules

- avoid browser-only assumptions in core flows;
- support touch-first interactions;
- respect mobile safe areas;
- support route-driven back navigation;
- keep modal logic compatible with full-screen mobile presentation.


## 23. Accessibility Rules

- full keyboard navigation on desktop;
- focus management for modals and sheets;
- accessible names for icon buttons;
- visible focus states;
- state must not be communicated by color alone;
- reorder actions must have a non-drag path.


## 24. Performance Rules

- fast initial load;
- lazy-load heavy editors or rarely used panels;
- avoid oversized libraries;
- debounce search;
- minimize rerenders in tab and grid views;
- keep page switching responsive.


## 25. Error Handling Rules

- empty states must look intentional;
- failed saves must be visible;
- reorder failures must not silently discard user actions;
- soft delete must require confirmation;
- placeholder settings must clearly indicate they are not final.


## 26. MVP Acceptance Criteria

The MVP is complete only if all of the following are true.

1. The app runs as a responsive web app and can be hosted on Firebase Hosting.
2. The initial empty state appears correctly when no pages exist.
3. The header contains tabs, a plus button, and a settings button.
4. The plus button opens the `Pages Hub`.
5. Pages can be created, renamed, soft-deleted, and reordered.
6. Pages open as persistent tabs and restore after reload.
7. Topics can be created, edited, opened, soft-deleted, and reordered.
8. Each page supports both grid and list topic views.
9. Topic detail opens correctly on desktop and mobile.
10. Search works inside each page.
11. Page and topic order persist across sessions.
12. The architecture keeps storage behind replaceable interfaces.
13. The UI remains clean and readable on phone and desktop.


## 27. Nice-to-Have After MVP

- sync conflict handling;
- tab pinning;
- public read-only share mode;
- backup export/import;
- global search across pages;
- category analytics;
- richer markdown editor;
- native Capacitor integrations.


## 28. Explicit Do and Do Not

### Do

- keep the product focused on pages, tabs, and study topics;
- separate the architecture into clear layers;
- persist the session reliably;
- design for future `Capacitor` packaging;
- prefer simple, legible interactions.

### Do Not

- do not build a generic dashboard;
- do not tie the domain directly to Firebase;
- do not make mobile feel like desktop shrunk down;
- do not make drag-and-drop the only reorder path;
- do not hide essential controls behind hover-only UI;
- do not let placeholder settings look like finished functionality.


## 29. Recommended Build Order

1. Define domain models and repository interfaces.
2. Build the app shell with header, tabs, plus button, and settings button.
3. Build the `Pages Hub` empty state and page list.
4. Implement page CRUD and page ordering.
5. Implement tab persistence and session restore.
6. Implement page view with search and topic layouts.
7. Implement topic CRUD and topic ordering.
8. Implement topic detail modal/full-screen behavior.
9. Add settings panel with real and placeholder items.
10. Add PWA polish and Firebase deployment configuration.


## 30. Final Definition of Done

The product is done when it feels like a small personal study workspace with tabs, not like a document viewer and not like a generic admin panel.

It must feel natural on:

- a phone in portrait orientation;
- a laptop with a trackpad;
- a desktop browser with keyboard and mouse;
- a future `Capacitor` wrapper without major structural changes.
