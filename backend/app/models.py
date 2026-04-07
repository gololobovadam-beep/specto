from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="ignore")


class PageCardSettings(StrictModel):
    minWidthPx: int
    titleFontSizePx: int
    titleLines: int
    showPreviewContent: bool
    previewLines: int


class PageEntity(StrictModel):
    id: str
    title: str
    slug: str
    preferredViewMode: str
    cardSettings: PageCardSettings
    sortOrder: int
    topicIds: list[str]
    deletedAt: str | None
    createdAt: str
    updatedAt: str


class TopicEntity(StrictModel):
    id: str
    pageId: str
    title: str
    summary: str
    bodyMarkdown: str
    categoryIds: list[str]
    sortOrder: int
    deletedAt: str | None
    createdAt: str
    updatedAt: str


class CategoryEntity(StrictModel):
    id: str
    name: str
    slug: str
    sortOrder: int
    isHidden: bool
    createdAt: str
    updatedAt: str


class TabSessionEntry(StrictModel):
    id: str
    pageId: str
    label: str
    openedAt: str
    lastVisitedAt: str


class PageUiState(StrictModel):
    searchQuery: str = ""


class AppSession(StrictModel):
    openTabs: list[TabSessionEntry] = Field(default_factory=list)
    activeTabId: str | None = None
    lastOpenedHub: bool = True
    pageUiStateByPageId: dict[str, PageUiState] = Field(default_factory=dict)
    schemaVersion: int = 1


class UserSettings(StrictModel):
    darkTheme: bool = False
    compactDensity: bool = False
    reducedMotion: bool = False
    showTopicCounters: bool = True
    futureCloudSyncEnabled: bool = False
    futureImportEnabled: bool = False


class WorkspaceSnapshot(StrictModel):
    pages: list[PageEntity] = Field(default_factory=list)
    topics: list[TopicEntity] = Field(default_factory=list)
    categories: list[CategoryEntity] = Field(default_factory=list)
    session: AppSession = Field(default_factory=AppSession)
    settings: UserSettings = Field(default_factory=UserSettings)


class WorkspaceResponse(StrictModel):
    snapshot: WorkspaceSnapshot
    revision: str | None = None


class RevisionResponse(StrictModel):
    revision: str | None = None


class SavePageRequest(StrictModel):
    page: PageEntity


class SavePagesRequest(StrictModel):
    pages: list[PageEntity]


class SaveTopicRequest(StrictModel):
    topic: TopicEntity


class SaveTopicsRequest(StrictModel):
    topics: list[TopicEntity]


class SaveCategoryRequest(StrictModel):
    category: CategoryEntity


class SaveCategoriesRequest(StrictModel):
    categories: list[CategoryEntity]


class SaveSessionRequest(StrictModel):
    session: AppSession


class SaveSettingsRequest(StrictModel):
    settings: UserSettings


class AuthenticatedUser(StrictModel):
    uid: str
    email: str | None = None


EntityId = Annotated[str, Field(min_length=1)]
