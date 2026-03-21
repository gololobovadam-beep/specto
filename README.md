# Study Pages

A web-first study workspace with persistent tabs, page hubs, topic cards, and a future path to Capacitor.

## Current implementation

- `React + TypeScript + Vite`
- `Firebase Auth + Firestore` for cross-device sync
- offline persistence through Firestore local cache
- local repository kept only as a migration/fallback layer
- `Firebase Hosting` config included for deployment
- `PWA` manifest and service worker via `vite-plugin-pwa`
- drag-and-drop page and topic ordering through `dnd-kit`

## Architecture

The code is split into:

- `src/domain` for entities and repository contracts
- `src/application` for use cases and orchestration
- `src/infrastructure` for storage adapters and Firebase integration
- `src/presentation` for React UI

UI components do not call Firebase directly. Firebase lives behind repository interfaces.

## Sync behavior

- Pages, topics, categories, settings, and tab session are stored in Firestore under `users/{uid}`.
- Signing in on another device restores the same workspace.
- Firestore offline cache keeps data available during refreshes, browser restarts, and temporary loss of internet.
- Clearing site storage removes only the local cache copy; the server copy remains in Firestore and is restored after sign-in.
- Existing local-only data are migrated to Firestore automatically the first time an empty cloud workspace is opened.

## Environment setup

Create `.env` from `.env.example` and fill in your Firebase web app config:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Firebase console setup

1. Create a Firebase project.
2. Add a Web App inside the project and copy its config into `.env`.
3. Enable `Authentication` and turn on the `Google` provider.
4. Create a Firestore database in production mode.
5. Deploy `firestore.rules`.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run preview`

## Deploy

```bash
npm install
npm run build
firebase login
firebase use --add
firebase deploy
```

This deploys both Hosting and Firestore rules because `firebase.json` includes both.
