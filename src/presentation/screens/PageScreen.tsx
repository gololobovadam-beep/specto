import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { CategoryEntity, PageCardSettings, TopicEntity } from "../../domain/models";
import { stripMarkdownToText } from "../utils/markdown";
import { useResponsiveGridLayout } from "../utils/responsiveGrid";
import {
  ActionButton,
  DropdownMenu,
  FieldLabel,
  OverlayPanel,
  SectionEmptyState
} from "../components/common";
import { MarkdownBodyEditor } from "../components/MarkdownBodyEditor";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { DRAG_START_DISTANCE_PX, LONG_PRESS_DELAY_MS, TouchSensor } from "../dnd/longPressSensors";
import { useWorkspace } from "../state/WorkspaceProvider";

interface TopicDraft {
  title: string;
  summary: string;
  bodyMarkdown: string;
  categoryIds: string[];
}

const EMPTY_DRAFT: TopicDraft = {
  title: "",
  summary: "",
  bodyMarkdown: "",
  categoryIds: []
};

export function PageScreen() {
  const navigate = useNavigate();
  const { pageId, topicId } = useParams();
  const {
    snapshot,
    openPageTab,
    savePageQuery,
    createTopic,
    updateTopic,
    duplicateTopic,
    softDeleteTopic,
    reorderTopics,
    createCategory,
    renameCategory,
    hideCategory,
    showCategory,
    deleteCategory
  } = useWorkspace();

  const page = snapshot.pages.find((item) => item.id === pageId && !item.deletedAt);
  const allTopics = useMemo(() => snapshot.topics.filter((item) => item.pageId === pageId && !item.deletedAt), [pageId, snapshot.topics]);
  const categories = useMemo(() => snapshot.categories.filter((item) => !item.isHidden), [snapshot.categories]);
  const activeTopic = allTopics.find((item) => item.id === topicId) ?? null;

  const storedQuery = pageId ? snapshot.session.pageUiStateByPageId[pageId]?.searchQuery ?? "" : "";
  const [query, setQuery] = useState(storedQuery);
  const previousPageIdRef = useRef(pageId);
  const previousStoredQueryRef = useRef(storedQuery);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [orderedTopicIds, setOrderedTopicIds] = useState<string[]>([]);
  const [activeDragTopicId, setActiveDragTopicId] = useState<string | null>(null);
  const [editorDraft, setEditorDraft] = useState<TopicDraft>(EMPTY_DRAFT);
  const [editorSavedDraft, setEditorSavedDraft] = useState<TopicDraft>(EMPTY_DRAFT);
  const [editorTopicId, setEditorTopicId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [isSavingEditor, setIsSavingEditor] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [renamingCategoryId, setRenamingCategoryId] = useState<string | null>(null);
  const [renamingCategoryValue, setRenamingCategoryValue] = useState("");
  const [categoryNotice, setCategoryNotice] = useState<{ id: number; message: string } | null>(null);
  const [topicGridElement, setTopicGridElement] = useState<HTMLDivElement | null>(null);
  const editorTitleInputId = useId();
  const editorSummaryInputId = useId();
  const renamingCategoryInputId = useId();

  useEffect(() => {
    if (!pageId || !page) {
      return;
    }

    const isOpen = snapshot.session.openTabs.some((tab) => tab.pageId === pageId);
    if (!isOpen) {
      void openPageTab(pageId);
    }
  }, [openPageTab, page, pageId, snapshot.session.openTabs]);

  useEffect(() => {
    const previousPageId = previousPageIdRef.current;
    const previousStoredQuery = previousStoredQueryRef.current;

    if (pageId !== previousPageId) {
      setQuery(storedQuery);
    } else if (storedQuery !== previousStoredQuery) {
      setQuery((current) => (current === previousStoredQuery ? storedQuery : current));
    }

    previousPageIdRef.current = pageId;
    previousStoredQueryRef.current = storedQuery;
  }, [storedQuery, pageId]);

  useEffect(() => {
    setOrderedTopicIds(allTopics.map((topic) => topic.id));
  }, [allTopics]);

  useEffect(() => {
    if (activeCategoryId && !categories.some((category) => category.id === activeCategoryId)) {
      setActiveCategoryId(null);
    }
  }, [activeCategoryId, categories]);

  useEffect(() => {
    if (!pageId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (query !== storedQuery) {
        void savePageQuery(pageId, query);
      }
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [pageId, query, savePageQuery, storedQuery]);

  useEffect(() => {
    if (!categoryNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCategoryNotice((current) => (current?.id === categoryNotice.id ? null : current));
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [categoryNotice]);


  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: DRAG_START_DISTANCE_PX }
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: LONG_PRESS_DELAY_MS, tolerance: 10 }
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const orderedTopics = useMemo(() => {
    const topicMap = new Map(allTopics.map((topic) => [topic.id, topic]));
    const arranged = orderedTopicIds.flatMap((id) => {
      const topic = topicMap.get(id);
      return topic ? [topic] : [];
    });
    const arrangedIds = new Set(arranged.map((topic) => topic.id));
    return [...arranged, ...allTopics.filter((topic) => !arrangedIds.has(topic.id))];
  }, [allTopics, orderedTopicIds]);

  const filteredTopics = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return orderedTopics.filter((topic) => {
      const matchesCategory = activeCategoryId ? topic.categoryIds.includes(activeCategoryId) : true;
      const matchesQuery = normalizedQuery
        ? [topic.title, topic.summary, topic.bodyMarkdown].join(" ").toLowerCase().includes(normalizedQuery)
        : true;

      return matchesCategory && matchesQuery;
    });
  }, [activeCategoryId, orderedTopics, query]);

  const activeDragTopic = orderedTopics.find((topic) => topic.id === activeDragTopicId) ?? null;
  const activeCategoryLabel = getActiveCategoryLabel(activeCategoryId, categories);
  const pageCategoryItems = getCategoryFilterItems(activeCategoryId, categories, setActiveCategoryId);
  const editorCategoryItems = getEditorCategoryItems(categories, editorDraft.categoryIds, setEditorDraft);
  const hasUnsavedEditorChanges = useMemo(() => !areTopicDraftsEqual(editorDraft, editorSavedDraft), [editorDraft, editorSavedDraft]);
  const topicGridLayout = useResponsiveGridLayout(topicGridElement, page?.cardSettings.minWidthPx ?? 240);

  function showCategoryNotice(message: string) {
    setCategoryNotice({ id: Date.now() + Math.random(), message });
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditorTopicId(null);
    setEditorDraft(cloneTopicDraft(EMPTY_DRAFT));
    setEditorSavedDraft(cloneTopicDraft(EMPTY_DRAFT));
    setIsSavingEditor(false);
  }

  function openCreateTopic() {
    const nextDraft = cloneTopicDraft(EMPTY_DRAFT);
    setEditorTopicId(null);
    setEditorDraft(nextDraft);
    setEditorSavedDraft(cloneTopicDraft(nextDraft));
    setEditorOpen(true);
  }

  function openEditTopic(topic: TopicEntity) {
    const nextDraft = createTopicDraftFromTopic(topic);
    setEditorTopicId(topic.id);
    setEditorDraft(nextDraft);
    setEditorSavedDraft(cloneTopicDraft(nextDraft));
    setEditorOpen(true);
  }

  async function persistTopicDraft() {
    if (!pageId || isSavingEditor) {
      return null;
    }

    const draftToPersist = cloneTopicDraft(editorDraft);
    setIsSavingEditor(true);

    try {
      if (editorTopicId) {
        await updateTopic(editorTopicId, draftToPersist);
        setEditorSavedDraft(cloneTopicDraft(draftToPersist));
        return editorTopicId;
      }

      const nextSnapshot = await createTopic(pageId, draftToPersist.title || undefined);
      const newest = nextSnapshot.topics
        .filter((topic) => topic.pageId === pageId && !topic.deletedAt)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];

      if (!newest) {
        return null;
      }

      await updateTopic(newest.id, draftToPersist);
      setEditorTopicId(newest.id);
      setEditorSavedDraft(cloneTopicDraft(draftToPersist));

      return newest.id;
    } finally {
      setIsSavingEditor(false);
    }
  }

  async function handleSaveTopic(event?: FormEvent) {
    event?.preventDefault();
    await persistTopicDraft();
  }

  async function handleDuplicateTopic(topic: TopicEntity) {
    await duplicateTopic(topic.id);
    navigate(`/pages/${topic.pageId}`);
  }

  async function handleDeleteTopic(topic: TopicEntity) {
    if (!window.confirm("Soft-delete this topic?")) {
      return;
    }

    await softDeleteTopic(topic.id);
    navigate(`/pages/${topic.pageId}`);
  }

  function handleTopicDragStart(event: DragStartEvent) {
    setActiveDragTopicId(String(event.active.id));
  }

  function handleTopicDragCancel() {
    setActiveDragTopicId(null);
  }

  function handleTopicDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragTopicId(null);

    if (!over || active.id === over.id || !pageId) {
      return;
    }

    const oldIndex = filteredTopics.findIndex((topic) => topic.id === active.id);
    const newIndex = filteredTopics.findIndex((topic) => topic.id === over.id);
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const visibleOrdered = arrayMove(filteredTopics, oldIndex, newIndex).map((topic) => topic.id);
    const untouchedIds = orderedTopics.filter((topic) => !visibleOrdered.includes(topic.id)).map((topic) => topic.id);
    const nextIds = [...visibleOrdered, ...untouchedIds];

    setOrderedTopicIds(nextIds);
    void reorderTopics(pageId, nextIds);
  }

  async function handleCreateCategory(event: FormEvent) {
    event.preventDefault();
    const categoryName = sanitizeCategoryName(newCategoryName);
    if (!categoryName) {
      return;
    }

    if (hasCategoryWithName(snapshot.categories, categoryName)) {
      showCategoryNotice("Category already exists.");
      return;
    }

    await createCategory(categoryName);
    setNewCategoryName("");
  }

  async function handleRenameCategory(event: FormEvent) {
    event.preventDefault();
    if (!renamingCategoryId) {
      return;
    }

    const currentCategory = snapshot.categories.find((item) => item.id === renamingCategoryId);
    const categoryName = sanitizeCategoryName(renamingCategoryValue) || currentCategory?.name || "";
    if (!categoryName) {
      return;
    }

    if (hasCategoryWithName(snapshot.categories, categoryName, renamingCategoryId)) {
      showCategoryNotice("Category already exists.");
      return;
    }

    await renameCategory(renamingCategoryId, categoryName);
    setRenamingCategoryId(null);
    setRenamingCategoryValue("");
  }

  async function handleDeleteCategory(category: CategoryEntity) {
    if (!window.confirm(`Delete "${category.name}"? It will be removed from all topic cards.`)) {
      return;
    }

    await deleteCategory(category.id);
  }

  useEffect(() => {
    if (!editorOpen) {
      return;
    }

    function handleEditorSaveShortcut(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") {
        return;
      }

      event.preventDefault();

      if (!hasUnsavedEditorChanges || isSavingEditor) {
        return;
      }

      void persistTopicDraft();
    }

    window.addEventListener("keydown", handleEditorSaveShortcut);

    return () => window.removeEventListener("keydown", handleEditorSaveShortcut);
  }, [editorOpen, hasUnsavedEditorChanges, isSavingEditor]);

  if (!pageId || !page) {
    return (
      <SectionEmptyState
        title="Page not found"
        description="This page does not exist or has been soft-deleted. Return to the hub and open another page."
        action={<ActionButton onClick={() => navigate("/")}>Back to hub</ActionButton>}
      />
    );
  }

  return (
    <>
      <section className="page-section page-section--page">
        <div className="page-toolbar">
          <div className="search-shell">
            <input
              className="search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search in this page"
            />
          </div>
          <div className="toolbar-actions">
            <ActionButton type="button" onClick={() => setCategoriesOpen(true)}>
              Categories
            </ActionButton>
            <ActionButton type="button" onClick={openCreateTopic}>
              New topic
            </ActionButton>
            <DropdownMenu
              label="Filter topics by category"
              triggerLabel={activeCategoryLabel}
              triggerVariant="button"
              className="toolbar-dropdown"
              items={pageCategoryItems}
            />
          </div>
        </div>

        {filteredTopics.length === 0 ? (
          <SectionEmptyState
            title={allTopics.length === 0 ? "No topics yet" : "Nothing matches this filter"}
            description={allTopics.length === 0 ? "Create your first topic for this page." : "Try another search query or clear the selected category."}
            action={
              allTopics.length === 0 ? (
                <ActionButton type="button" onClick={openCreateTopic}>
                  Create topic
                </ActionButton>
              ) : undefined
            }
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleTopicDragStart}
            onDragCancel={handleTopicDragCancel}
            onDragEnd={handleTopicDragEnd}
          >
            <SortableContext
              items={filteredTopics.map((topic) => topic.id)}
              strategy={page.preferredViewMode === "grid" ? rectSortingStrategy : verticalListSortingStrategy}
            >
              <div
                ref={setTopicGridElement}
                className={`topic-grid topic-grid--${page.preferredViewMode}`.trim()}
                style={getTopicGridStyle(page.preferredViewMode === "list", topicGridLayout.gapPx)}
              >
                {filteredTopics.map((topic) => (
                  <SortableTopicCard
                    key={topic.id}
                    topic={topic}
                    compact={snapshot.settings.compactDensity}
                    listMode={page.preferredViewMode === "list"}
                    cardWidthPx={topicGridLayout.cardWidthPx}
                    cardSettings={page.cardSettings}
                    onOpen={() => navigate(`/pages/${page.id}/topics/${topic.id}`)}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeDragTopic ? (
                <TopicCardPreview
                  topic={activeDragTopic}
                  compact={snapshot.settings.compactDensity}
                  listMode={page.preferredViewMode === "list"}
                  cardWidthPx={topicGridLayout.cardWidthPx}
                  cardSettings={page.cardSettings}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </section>

      <OverlayPanel
        open={editorOpen}
        title={editorTopicId ? "Edit topic" : "Create topic"}
        onClose={closeEditor}
        className="overlay__panel--wide"
        actions={
          <ActionButton
            type="button"
            variant="secondary"
            className={`button--small overlay__save-button ${hasUnsavedEditorChanges ? "overlay__save-button--dirty" : ""}`.trim()}
            onClick={() => void persistTopicDraft()}
            disabled={!hasUnsavedEditorChanges || isSavingEditor}
            aria-label={isSavingEditor ? "Saving topic" : "Save topic"}
          >
            <SaveIcon />
          </ActionButton>
        }
      >
        <form className="stack-form" onSubmit={handleSaveTopic}>
          <FieldLabel label="Title" htmlFor={editorTitleInputId}>
            <input
              id={editorTitleInputId}
              autoFocus
              value={editorDraft.title}
              onChange={(event) => setEditorDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="Decorators overview"
            />
          </FieldLabel>
          <FieldLabel label="Summary" htmlFor={editorSummaryInputId}>
            <textarea
              id={editorSummaryInputId}
              rows={3}
              value={editorDraft.summary}
              onChange={(event) => setEditorDraft((current) => ({ ...current, summary: event.target.value }))}
              placeholder="Short summary for the card preview"
            />
          </FieldLabel>
          <FieldLabel label="Content">
            <MarkdownBodyEditor
              value={editorDraft.bodyMarkdown}
              onChange={(bodyMarkdown) => setEditorDraft((current) => ({ ...current, bodyMarkdown }))}
              placeholder={"# Main idea\n\nExplain the topic in a few paragraphs.\n\n- First key point\n- Example or note"}
            />
          </FieldLabel>
          <FieldLabel label="Categories">
            <DropdownMenu
              label="Select categories for this topic"
              triggerLabel={getEditorCategoryLabel(editorDraft.categoryIds, categories)}
              triggerVariant="button"
              className="editor-category-dropdown"
              preferredPlacement="top"
              items={editorCategoryItems}
            />
          </FieldLabel>
        </form>
      </OverlayPanel>

      <OverlayPanel
        open={categoriesOpen}
        title="Manage categories"
        subtitle="Global categories stay reusable across all pages."
        onClose={() => setCategoriesOpen(false)}
      >
        <div className="stack-form">
          <form className="inline-form" onSubmit={handleCreateCategory}>
            <input
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="Add category"
            />
            <ActionButton type="submit" variant="primary">
              Add
            </ActionButton>
          </form>
          <div className="category-list">
            {snapshot.categories.map((category) => (
              <div key={category.id} className="category-row">
                <div>
                  <strong>{category.name}</strong>
                  <p>{category.isHidden ? "Hidden" : "Visible"}</p>
                </div>
                <div className="category-row__actions">
                  <ActionButton
                    type="button"
                    onClick={() => {
                      setRenamingCategoryId(category.id);
                      setRenamingCategoryValue(category.name);
                    }}
                  >
                    Rename
                  </ActionButton>
                  {!category.isHidden ? (
                    <ActionButton type="button" variant="ghost" onClick={() => hideCategory(category.id)}>
                      Hide
                    </ActionButton>
                  ) : (
                    <ActionButton type="button" variant="ghost" onClick={() => showCategory(category.id)}>
                      Visible
                    </ActionButton>
                  )}
                  <ActionButton type="button" variant="danger" onClick={() => handleDeleteCategory(category)}>
                    Delete
                  </ActionButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      </OverlayPanel>

      <OverlayPanel
        open={Boolean(renamingCategoryId)}
        title="Rename category"
        subtitle="This updates the label wherever the category is used."
        onClose={() => setRenamingCategoryId(null)}
      >
        <form className="stack-form" onSubmit={handleRenameCategory}>
          <FieldLabel label="Category name" htmlFor={renamingCategoryInputId}>
            <input
              id={renamingCategoryInputId}
              autoFocus
              value={renamingCategoryValue}
              onChange={(event) => setRenamingCategoryValue(event.target.value)}
              placeholder="Object model"
            />
          </FieldLabel>
          <div className="form-actions">
            <ActionButton type="button" onClick={() => setRenamingCategoryId(null)}>
              Cancel
            </ActionButton>
            <ActionButton type="submit" variant="primary">
              Save
            </ActionButton>
          </div>
        </form>
      </OverlayPanel>

      <OverlayPanel
        open={Boolean(activeTopic)}
        title={activeTopic?.title ?? "Topic"}
        onClose={() => navigate(`/pages/${page.id}`)}
        className="overlay__panel--wide overlay__panel--detail"
        closeLabel="Close"
        actions={
          activeTopic ? (
            <DropdownMenu
              label={`Topic actions for ${activeTopic.title}`}
              triggerLabel="Options"
              triggerVariant="button"
              className="overlay__action-menu"
              items={[
                {
                  id: "edit",
                  label: "Edit",
                  onSelect: () => {
                    openEditTopic(activeTopic);
                  }
                },
                { id: "duplicate", label: "Duplicate", onSelect: () => handleDuplicateTopic(activeTopic) },
                { id: "delete", label: "Delete (soft)", onSelect: () => handleDeleteTopic(activeTopic), danger: true }
              ]}
            />
          ) : null
        }
      >
        {activeTopic ? (
          <div className="detail-view">
            {categories.some((category) => activeTopic.categoryIds.includes(category.id)) ? (
              <div className="detail-view__meta">
                <div className="chip-row chip-row--static">
                  {categories
                    .filter((category) => activeTopic.categoryIds.includes(category.id))
                    .map((category) => (
                      <span key={category.id} className="chip chip--passive">{category.name}</span>
                    ))}
                </div>
              </div>
            ) : null}
            {activeTopic.summary ? <p className="detail-summary">{activeTopic.summary}</p> : null}
            <MarkdownRenderer className="markdown-body" markdown={activeTopic.bodyMarkdown} />
          </div>
        ) : null}
      </OverlayPanel>

      {categoryNotice ? (
        <div className="toast-notice" role="status" aria-live="polite">
          {categoryNotice.message}
        </div>
      ) : null}

    </>
  );
}

function createTopicDraftFromTopic(topic: TopicEntity): TopicDraft {
  return {
    title: topic.title,
    summary: topic.summary,
    bodyMarkdown: topic.bodyMarkdown,
    categoryIds: [...topic.categoryIds]
  };
}

function cloneTopicDraft(draft: TopicDraft): TopicDraft {
  return {
    title: draft.title,
    summary: draft.summary,
    bodyMarkdown: draft.bodyMarkdown,
    categoryIds: [...draft.categoryIds]
  };
}

function areTopicDraftsEqual(left: TopicDraft, right: TopicDraft) {
  return (
    left.title === right.title &&
    left.summary === right.summary &&
    left.bodyMarkdown === right.bodyMarkdown &&
    left.categoryIds.length === right.categoryIds.length &&
    left.categoryIds.every((categoryId, index) => categoryId === right.categoryIds[index])
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M5 4.75h10.75l3.5 3.5v11A1.75 1.75 0 0 1 17.5 21H6.5A1.75 1.75 0 0 1 4.75 19.25V6.5A1.75 1.75 0 0 1 6.5 4.75Zm1.25 1.5v12.5c0 .41.34.75.75.75h10c.41 0 .75-.34.75-.75V8.87l-2.62-2.62H14v3.25a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V6.25H7c-.41 0-.75.34-.75.75Zm3.25 0V9h3V6.25h-3Zm-1 8.5a.75.75 0 0 1 .75-.75h5.5a.75.75 0 0 1 0 1.5h-5.5a.75.75 0 0 1-.75-.75Z"
        fill="currentColor"
      />
    </svg>
  );
}
function SortableTopicCard({
  topic,
  compact,
  listMode,
  cardWidthPx,
  cardSettings,
  onOpen
}: {
  topic: TopicEntity;
  compact: boolean;
  listMode: boolean;
  cardWidthPx: number;
  cardSettings: PageCardSettings;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: topic.id });
  const previewText = getTopicPreviewText(topic);

  function handleCardClick(event: ReactMouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (target.closest(".menu")) {
      return;
    }

    onOpen();
  }

  function handleCardKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest(".menu")) {
      return;
    }

    event.preventDefault();
    onOpen();
  }

  return (
    <article
      ref={setNodeRef}
      style={getTopicCardStyle(cardSettings, transform, transition, compact, listMode, cardWidthPx)}
      className={`surface-card topic-card topic-card--interactive ${listMode ? "topic-card--list" : ""} ${cardSettings.showPreviewContent ? "topic-card--with-preview" : "topic-card--title-only"} ${compact ? "topic-card--compact" : ""} ${isDragging ? "surface-card--dragging" : ""}`.trim()}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      {...attributes}
      {...listeners}
    >
      <div className="topic-card__header">
        <div className={`topic-card__title ${cardSettings.showPreviewContent ? "topic-card__title--with-preview" : "topic-card__title--title-only"}`.trim()}>
          <h3>{topic.title}</h3>
          {cardSettings.showPreviewContent ? <p className="topic-card__preview">{previewText}</p> : null}
        </div>
      </div>
    </article>
  );
}

function TopicCardPreview({
  topic,
  compact,
  listMode,
  cardWidthPx,
  cardSettings
}: {
  topic: TopicEntity;
  compact: boolean;
  listMode: boolean;
  cardWidthPx: number;
  cardSettings: PageCardSettings;
}) {
  const previewText = getTopicPreviewText(topic);

  return (
    <article
      style={getTopicCardStyle(cardSettings, null, undefined, compact, listMode, cardWidthPx)}
      className={`surface-card topic-card ${listMode ? "topic-card--list" : ""} ${cardSettings.showPreviewContent ? "topic-card--with-preview" : "topic-card--title-only"} ${compact ? "topic-card--compact" : ""} topic-card--overlay surface-card--dragging`.trim()}
    >
      <div className="topic-card__header">
        <div className={`topic-card__title ${cardSettings.showPreviewContent ? "topic-card__title--with-preview" : "topic-card__title--title-only"}`.trim()}>
          <h3>{topic.title}</h3>
          {cardSettings.showPreviewContent ? <p className="topic-card__preview">{previewText}</p> : null}
        </div>
      </div>
    </article>
  );
}

function getTopicPreviewText(topic: TopicEntity) {
  return [topic.summary, stripMarkdownToText(topic.bodyMarkdown)].filter(Boolean).join(" ") || "Open to add content.";
}

function getTopicGridStyle(listMode: boolean, gapPx: number): CSSProperties {
  return {
    "--grid-gap": `${gapPx}px`,
    justifyContent: listMode ? undefined : "flex-start"
  } as CSSProperties;
}

function getTopicCardStyle(
  cardSettings: PageCardSettings,
  transform: { x: number; y: number; scaleX: number; scaleY: number } | null,
  transition: string | undefined,
  compact: boolean,
  listMode: boolean,
  cardWidthPx: number
): CSSProperties {
  const basePadding = Math.max(10, Math.round(cardSettings.minWidthPx * 0.08) - (compact ? 2 : 0));
  const innerGap = Math.max(10, Math.round(basePadding * 0.75));
  const previewFontSizePx = Number((cardSettings.titleFontSizePx * 0.8).toFixed(1));
  const titleLineHeight = 1.18;
  const previewLineHeight = 1.55;
  const titleBlockHeightPx = Number((cardSettings.titleFontSizePx * titleLineHeight * cardSettings.titleLines).toFixed(1));
  const previewBlockHeightPx = Number((previewFontSizePx * previewLineHeight * cardSettings.previewLines).toFixed(1));
  const titleOnlyMinHeightPx = Math.ceil(basePadding * 2 + titleBlockHeightPx);
  const withPreviewMinHeightPx = Math.ceil(basePadding * 2 + innerGap + titleBlockHeightPx + previewBlockHeightPx);

  return {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    width: listMode ? "100%" : `min(100%, ${cardWidthPx}px)`,
    maxWidth: "100%",
    flex: listMode ? undefined : "0 0 auto",
    "--card-padding": `${basePadding}px`,
    "--card-inner-gap": `${innerGap}px`,
    "--card-title-font-size": `${cardSettings.titleFontSizePx}px`,
    "--card-title-line-height": `${titleLineHeight}`,
    "--card-title-lines": `${cardSettings.titleLines}`,
    "--card-title-block-height": `${titleBlockHeightPx}px`,
    "--card-preview-font-size": `${previewFontSizePx}px`,
    "--card-preview-lines": `${cardSettings.previewLines}`,
    "--card-preview-block-height": `${previewBlockHeightPx}px`,
    "--topic-card-title-only-min-height": `${titleOnlyMinHeightPx}px`,
    "--topic-card-with-preview-min-height": `${withPreviewMinHeightPx}px`
  } as CSSProperties;
}

function getActiveCategoryLabel(activeCategoryId: string | null, categories: CategoryEntity[]) {
  if (!activeCategoryId) {
    return "All categories";
  }

  return categories.find((category) => category.id === activeCategoryId)?.name ?? "All categories";
}

function getCategoryFilterItems(
  activeCategoryId: string | null,
  categories: CategoryEntity[],
  setActiveCategoryId: (categoryId: string | null) => void
) {
  if (categories.length === 0) {
    return [
      {
        id: "no-categories",
        label: "No categories yet",
        onSelect: () => undefined,
        disabled: true
      }
    ];
  }

  return [
    {
      id: "all-categories",
      label: "All categories",
      selected: activeCategoryId === null,
      onSelect: () => setActiveCategoryId(null)
    },
    ...categories.map((category) => ({
      id: category.id,
      label: category.name,
      selected: activeCategoryId === category.id,
      onSelect: () => setActiveCategoryId(category.id)
    }))
  ];
}

function getEditorCategoryItems(
  categories: CategoryEntity[],
  selectedCategoryIds: string[],
  setEditorDraft: Dispatch<SetStateAction<TopicDraft>>
) {
  if (categories.length === 0) {
    return [
      {
        id: "no-categories",
        label: "No categories yet",
        onSelect: () => undefined,
        disabled: true
      }
    ];
  }

  return categories.map((category) => ({
    id: category.id,
    label: category.name,
    selected: selectedCategoryIds.includes(category.id),
    keepOpen: true,
    onSelect: () => {
      setEditorDraft((current) => ({
        ...current,
        categoryIds: current.categoryIds.includes(category.id)
          ? current.categoryIds.filter((id) => id !== category.id)
          : [...current.categoryIds, category.id]
      }));
    }
  }));
}

function getEditorCategoryLabel(selectedCategoryIds: string[], categories: CategoryEntity[]) {
  if (selectedCategoryIds.length === 0) {
    return "No categories";
  }

  if (selectedCategoryIds.length === 1) {
    return categories.find((category) => category.id === selectedCategoryIds[0])?.name ?? "1 category";
  }

  return `${selectedCategoryIds.length} categories`;
}

function sanitizeCategoryName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function hasCategoryWithName(categories: CategoryEntity[], name: string, excludedCategoryId?: string) {
  const normalizedName = sanitizeCategoryName(name).toLocaleLowerCase();
  return normalizedName
    ? categories.some(
        (category) => category.id !== excludedCategoryId && sanitizeCategoryName(category.name).toLocaleLowerCase() === normalizedName
      )
    : false;
}
