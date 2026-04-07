from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware

from .auth import FirebaseTokenVerifier, get_current_user
from .config import load_settings
from .models import (
    AuthenticatedUser,
    EntityId,
    RevisionResponse,
    SaveCategoriesRequest,
    SaveCategoryRequest,
    SavePageRequest,
    SavePagesRequest,
    SaveSessionRequest,
    SaveSettingsRequest,
    SaveTopicRequest,
    SaveTopicsRequest,
    WorkspaceResponse,
)
from .store import YdbWorkspaceStore

app_settings = load_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    store = YdbWorkspaceStore(app_settings)
    token_verifier = FirebaseTokenVerifier(app_settings)

    app.state.settings = app_settings
    app.state.store = store
    app.state.token_verifier = token_verifier

    try:
        yield
    finally:
        store.close()


app = FastAPI(
    title="Specto Workspace API",
    version="0.1.0",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=app_settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_store(request: Request) -> YdbWorkspaceStore:
    return request.app.state.store


@app.get("/healthz")
def healthcheck():
    return {"status": "ok"}


@app.get("/api/workspace", response_model=WorkspaceResponse)
def get_workspace(
    current_user: AuthenticatedUser = Depends(get_current_user),
    store: YdbWorkspaceStore = Depends(get_store),
):
    snapshot, revision = store.load_workspace(current_user.uid)
    return WorkspaceResponse(snapshot=snapshot, revision=revision)


@app.get("/api/workspace/meta", response_model=RevisionResponse)
def get_workspace_meta(
    current_user: AuthenticatedUser = Depends(get_current_user),
    store: YdbWorkspaceStore = Depends(get_store),
):
    return RevisionResponse(revision=store.get_revision(current_user.uid))


@app.put("/api/workspace/pages/_batch", response_model=RevisionResponse)
def save_pages_batch(
    payload: SavePagesRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    store: YdbWorkspaceStore = Depends(get_store),
):
    return RevisionResponse(revision=store.save_pages(current_user.uid, payload.pages))


@app.put("/api/workspace/pages/{page_id}", response_model=RevisionResponse)
def save_page(
    page_id: EntityId,
    payload: SavePageRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    store: YdbWorkspaceStore = Depends(get_store),
):
    if payload.page.id != page_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Page id in path does not match payload",
        )

    return RevisionResponse(revision=store.save_page(current_user.uid, payload.page))


@app.put("/api/workspace/topics/_batch", response_model=RevisionResponse)
def save_topics_batch(
    payload: SaveTopicsRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    store: YdbWorkspaceStore = Depends(get_store),
):
    return RevisionResponse(revision=store.save_topics(current_user.uid, payload.topics))


@app.put("/api/workspace/topics/{topic_id}", response_model=RevisionResponse)
def save_topic(
    topic_id: EntityId,
    payload: SaveTopicRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    store: YdbWorkspaceStore = Depends(get_store),
):
    if payload.topic.id != topic_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Topic id in path does not match payload",
        )

    return RevisionResponse(revision=store.save_topic(current_user.uid, payload.topic))


@app.put("/api/workspace/categories/_batch", response_model=RevisionResponse)
def save_categories_batch(
    payload: SaveCategoriesRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    store: YdbWorkspaceStore = Depends(get_store),
):
    return RevisionResponse(revision=store.save_categories(current_user.uid, payload.categories))


@app.put("/api/workspace/categories/{category_id}", response_model=RevisionResponse)
def save_category(
    category_id: EntityId,
    payload: SaveCategoryRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    store: YdbWorkspaceStore = Depends(get_store),
):
    if payload.category.id != category_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category id in path does not match payload",
        )

    return RevisionResponse(revision=store.save_category(current_user.uid, payload.category))


@app.delete("/api/workspace/categories/{category_id}", response_model=RevisionResponse)
def delete_category(
    category_id: EntityId,
    current_user: AuthenticatedUser = Depends(get_current_user),
    store: YdbWorkspaceStore = Depends(get_store),
):
    return RevisionResponse(revision=store.delete_category(current_user.uid, category_id))


@app.put("/api/workspace/session", response_model=RevisionResponse)
def save_session(
    payload: SaveSessionRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    store: YdbWorkspaceStore = Depends(get_store),
):
    return RevisionResponse(revision=store.save_session(current_user.uid, payload.session))


@app.put("/api/workspace/settings", response_model=RevisionResponse)
def save_settings(
    payload: SaveSettingsRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    store: YdbWorkspaceStore = Depends(get_store),
):
    return RevisionResponse(revision=store.save_settings(current_user.uid, payload.settings))
