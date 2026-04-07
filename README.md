# Study Pages

A web-first study workspace with persistent tabs, page hubs, topic cards, and a future path to Capacitor.

## Current implementation

- `React + TypeScript + Vite`
- `Firebase Auth` for Google sign-in
- `FastAPI + YDB` workspace API for cloud sync when `VITE_WORKSPACE_API_BASE_URL` is set
- `Firestore` kept as a fallback cloud adapter when the API is not configured
- local repository kept as a migration/fallback layer
- `PWA` manifest and service worker via `vite-plugin-pwa`
- drag-and-drop page and topic ordering through `dnd-kit`

## Architecture

The code is split into:

- `src/domain` for entities and repository contracts
- `src/application` for use cases and orchestration
- `src/infrastructure` for storage adapters, Firebase auth, and the optional workspace API client
- `src/presentation` for React UI
- `backend/app` for the FastAPI service that verifies Firebase ID tokens and persists data in YDB

UI components do not call Firebase, YDB, or HTTP directly. Cloud storage stays behind repository interfaces.

## Sync modes

The frontend now supports three storage modes:

- `api`: `Firebase Auth + FastAPI + YDB`
- `firebase`: legacy `Firebase Auth + Firestore`
- `local`: browser-local fallback when cloud storage is unavailable

Selection is automatic:

1. If `VITE_WORKSPACE_API_BASE_URL` is configured, the app uses the FastAPI backend.
2. Otherwise, if Firebase Firestore config is available, the app uses Firestore.
3. Otherwise, the app falls back to local storage.

## Sync behavior

- Pages, topics, categories, settings, and tab session remain user-scoped by Firebase `uid`.
- Signing in on another device restores the same workspace.
- Existing local-only data are migrated automatically the first time an empty cloud workspace is opened.
- In API mode the frontend polls workspace revision metadata and reloads when another device changes the workspace.

## Frontend environment setup

Create `.env` from `.env.example` and fill in your Firebase web app config:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

To switch cloud storage from Firestore to the FastAPI backend, also set:

```bash
VITE_WORKSPACE_API_BASE_URL=http://localhost:8080
VITE_WORKSPACE_API_SYNC_INTERVAL_MS=5000
```

## Firebase console setup

1. Create a Firebase project.
2. Add a Web App inside the project and copy its config into `.env`.
3. Enable `Authentication` and turn on the `Google` provider.
4. If you want to keep the legacy Firestore mode available, create Firestore and deploy `firestore.rules`.
5. Create a Firebase service account for the backend token verification flow.

## Backend environment setup

Create `backend/.env` from `backend/.env.example` and fill in:

```bash
APP_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
YDB_ENDPOINT=...
YDB_DATABASE=...
YDB_TABLE_PREFIX=specto
FIREBASE_PROJECT_ID=...
FIREBASE_SERVICE_ACCOUNT_FILE=/run/secrets/firebase-service-account.json
```

YDB credentials are resolved by the official YDB SDK from environment variables. Typical options are:

- `YDB_TOKEN=...` for local token-based access
- `USE_METADATA_CREDENTIALS=1` inside Yandex Cloud serverless containers
- `SA_KEY_FILE=/path/to/authorized-key.json` for local service-account-key access

The backend auto-creates its tables on startup when `YDB_AUTO_CREATE_SCHEMA=1`.

## Local development

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

If `VITE_WORKSPACE_API_BASE_URL` is configured, start the backend before opening the app.

## Backend API

The FastAPI backend exposes:

- `GET /healthz`
- `GET /api/workspace`
- `GET /api/workspace/meta`
- `PUT /api/workspace/pages/_batch`
- `PUT /api/workspace/pages/{page_id}`
- `PUT /api/workspace/topics/_batch`
- `PUT /api/workspace/topics/{topic_id}`
- `PUT /api/workspace/categories/_batch`
- `PUT /api/workspace/categories/{category_id}`
- `DELETE /api/workspace/categories/{category_id}`
- `PUT /api/workspace/session`
- `PUT /api/workspace/settings`

Every request must include a Firebase ID token in the `Authorization: Bearer ...` header.

## Deploy

Frontend build:

```bash
npm install
npm run build
```

Backend container image:

```bash
cd backend
docker build -t specto-workspace-api .
```

A typical Yandex Cloud deployment path is:

1. Push the backend image to `Container Registry`.
2. Deploy it to `Serverless Containers` with `USE_METADATA_CREDENTIALS=1` and the Firebase service-account secret mounted as an env var or file.
3. Create a public HTTPS endpoint for the container.
4. Set `VITE_WORKSPACE_API_BASE_URL` in the frontend build.
5. Deploy the frontend static build wherever you host the site.

## Legacy Firestore deploy

If you want the original Firebase-only mode:

```bash
firebase login
firebase use --add
firebase deploy
```

This still deploys both Hosting and Firestore rules because `firebase.json` includes both.
