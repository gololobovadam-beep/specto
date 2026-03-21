import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
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
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import type { CategoryEntity, PageCardSettings, TopicEntity } from "../../domain/models";
import {
  ActionButton,
  DropdownMenu,
  FieldLabel,
  OverlayPanel,
  SectionEmptyState
} from "../components/common";
import { LONG_PRESS_DELAY_MS, RightClickMouseSensor, TouchSensor } from "../dnd/longPressSensors";
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
    setPageViewMode
  } = useWorkspace();

  const page = snapshot.pages.find((item) => item.id === pageId && !item.deletedAt);
  const allTopics = useMemo(() => snapshot.topics.filter((item) => item.pageId === pageId && !item.deletedAt), [pageId, snapshot.topics]);
  const categories = useMemo(() => snapshot.categories.filter((item) => !item.isHidden), [snapshot.categories]);
  const activeTopic = allTopics.find((item) => item.id === topicId) ?? null;

  const storedQuery = pageId ? snapshot.session.pageUiStateByPageId[pageId]?.searchQuery ?? "" : "";
  const [query, setQuery] = useState(storedQuery);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [orderedTopicIds, setOrderedTopicIds] = useState<string[]>([]);
  const [activeDragTopicId, setActiveDragTopicId] = useState<string | null>(null);
  const [editorDraft, setEditorDraft] = useState<TopicDraft>(EMPTY_DRAFT);
  const [editorTopicId, setEditorTopicId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [renamingCategoryId, setRenamingCategoryId] = useState<string | null>(null);
  const [renamingCategoryValue, setRenamingCategoryValue] = useState("");

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
    setQuery(storedQuery);
  }, [storedQuery, pageId]);

  useEffect(() => {
    setOrderedTopicIds(allTopics.map((topic) => topic.id));
  }, [allTopics]);

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

  const sensors = useSensors(
    useSensor(RightClickMouseSensor, {
      activationConstraint: { delay: LONG_PRESS_DELAY_MS, tolerance: 8 },
      onActivation: ({ event }) => event.preventDefault()
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

  function openCreateTopic() {
    setEditorTopicId(null);
    setEditorDraft(EMPTY_DRAFT);
    setEditorOpen(true);
  }

  function openEditTopic(topic: TopicEntity) {
    setEditorTopicId(topic.id);
    setEditorDraft({
      title: topic.title,
      summary: topic.summary,
      bodyMarkdown: topic.bodyMarkdown,
      categoryIds: topic.categoryIds
    });
    setEditorOpen(true);
  }

  async function handleSaveTopic(event: FormEvent) {
    event.preventDefault();
    if (!pageId) {
      return;
    }

    if (editorTopicId) {
      await updateTopic(editorTopicId, editorDraft);
    } else {
      const nextSnapshot = await createTopic(pageId, editorDraft.title || undefined);
      const newest = nextSnapshot.topics
        .filter((topic) => topic.pageId === pageId && !topic.deletedAt)
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];

      if (newest) {
        await updateTopic(newest.id, editorDraft);
      }
    }

    setEditorOpen(false);
    setEditorTopicId(null);
    setEditorDraft(EMPTY_DRAFT);
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
    if (!newCategoryName.trim()) {
      return;
    }

    await createCategory(newCategoryName);
    setNewCategoryName("");
  }

  async function handleRenameCategory(event: FormEvent) {
    event.preventDefault();
    if (!renamingCategoryId) {
      return;
    }

    await renameCategory(renamingCategoryId, renamingCategoryValue);
    setRenamingCategoryId(null);
    setRenamingCategoryValue("");
  }

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
            <ActionButton
              type="button"
              onClick={() => setPageViewMode(page.id, page.preferredViewMode === "grid" ? "list" : "grid")}
            >
              {page.preferredViewMode === "grid" ? "Show as list" : "Show as cards"}
            </ActionButton>
            <ActionButton type="button" onClick={() => setCategoriesOpen(true)}>
              Categories
            </ActionButton>
            <ActionButton type="button" variant="primary" onClick={openCreateTopic}>
              New topic
            </ActionButton>
          </div>
        </div>

        {categories.length > 0 ? (
          <div className="chip-row">
            <button
              type="button"
              className={`chip ${activeCategoryId === null ? "chip--active" : ""}`.trim()}
              onClick={() => setActiveCategoryId(null)}
            >
              All categories
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`chip ${activeCategoryId === category.id ? "chip--active" : ""}`.trim()}
                onClick={() => setActiveCategoryId((current) => (current === category.id ? null : category.id))}
              >
                {category.name}
              </button>
            ))}
          </div>
        ) : null}

        {filteredTopics.length === 0 ? (
          <SectionEmptyState
            title={allTopics.length === 0 ? "No topics yet" : "Nothing matches this filter"}
            description={allTopics.length === 0 ? "Create your first topic for this page." : "Try another search query or clear the selected category."}
            action={
              allTopics.length === 0 ? (
                <ActionButton type="button" variant="primary" onClick={openCreateTopic}>
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
              <div className={`topic-grid topic-grid--${page.preferredViewMode}`.trim()} style={getTopicGridStyle(page.cardSettings)}>
                {filteredTopics.map((topic) => (
                  <SortableTopicCard
                    key={topic.id}
                    topic={topic}
                    categories={categories.filter((category) => topic.categoryIds.includes(category.id))}
                    compact={snapshot.settings.compactDensity}
                    listMode={page.preferredViewMode === "list"}
                    cardSettings={page.cardSettings}
                    onOpen={() => navigate(`/pages/${page.id}/topics/${topic.id}`)}
                    onEdit={() => openEditTopic(topic)}
                    onDuplicate={() => handleDuplicateTopic(topic)}
                    onDelete={() => handleDeleteTopic(topic)}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeDragTopic ? (
                <TopicCardPreview
                  topic={activeDragTopic}
                  categories={categories.filter((category) => activeDragTopic.categoryIds.includes(category.id))}
                  compact={snapshot.settings.compactDensity}
                  listMode={page.preferredViewMode === "list"}
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
        subtitle="Use markdown for the main content."
        onClose={() => setEditorOpen(false)}
        className="overlay__panel--wide"
      >
        <form className="stack-form" onSubmit={handleSaveTopic}>
          <FieldLabel label="Title">
            <input
              autoFocus
              value={editorDraft.title}
              onChange={(event) => setEditorDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="Decorators overview"
            />
          </FieldLabel>
          <FieldLabel label="Summary">
            <textarea
              rows={3}
              value={editorDraft.summary}
              onChange={(event) => setEditorDraft((current) => ({ ...current, summary: event.target.value }))}
              placeholder="One-sentence description for the card preview"
            />
          </FieldLabel>
          <FieldLabel label="Markdown content">
            <textarea
              rows={14}
              value={editorDraft.bodyMarkdown}
              onChange={(event) => setEditorDraft((current) => ({ ...current, bodyMarkdown: event.target.value }))}
              placeholder="# Key idea\n\n- bullet\n- code example"
            />
          </FieldLabel>
          <div className="category-checklist">
            {categories.map((category) => {
              const checked = editorDraft.categoryIds.includes(category.id);
              return (
                <label key={category.id} className="checkbox-chip">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      setEditorDraft((current) => ({
                        ...current,
                        categoryIds: event.target.checked
                          ? [...current.categoryIds, category.id]
                          : current.categoryIds.filter((id) => id !== category.id)
                      }));
                    }}
                  />
                  <span>{category.name}</span>
                </label>
              );
            })}
          </div>
          <div className="form-actions">
            <ActionButton type="button" onClick={() => setEditorOpen(false)}>
              Cancel
            </ActionButton>
            <ActionButton type="submit" variant="primary">
              Save topic
            </ActionButton>
          </div>
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
                  ) : null}
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
          <FieldLabel label="Category name">
            <input
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
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeTopic.bodyMarkdown || "No content yet."}</ReactMarkdown>
            </div>
          </div>
        ) : null}
      </OverlayPanel>
    </>
  );
}

function SortableTopicCard({
  topic,
  categories,
  compact,
  listMode,
  cardSettings,
  onOpen,
  onEdit,
  onDuplicate,
  onDelete
}: {
  topic: TopicEntity;
  categories: CategoryEntity[];
  compact: boolean;
  listMode: boolean;
  cardSettings: PageCardSettings;
  onOpen: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
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
      style={getTopicCardStyle(cardSettings, transform, transition, compact)}
      className={`surface-card topic-card topic-card--interactive ${listMode ? "topic-card--list" : ""} ${compact ? "topic-card--compact" : ""} ${isDragging ? "surface-card--dragging" : ""}`.trim()}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      onContextMenu={(event) => event.preventDefault()}
      {...attributes}
      {...listeners}
    >
      <div className="topic-card__header">
        <div className={`topic-card__title ${cardSettings.showPreviewContent ? "" : "topic-card__title--title-only"}`.trim()}>
          <h3>{topic.title}</h3>
          {cardSettings.showPreviewContent ? <p className="topic-card__preview">{previewText}</p> : null}
        </div>
        <DropdownMenu
          label={`Topic actions for ${topic.title}`}
          items={[
            { id: "edit", label: "Edit", onSelect: onEdit },
            { id: "duplicate", label: "Duplicate", onSelect: onDuplicate },
            { id: "delete", label: "Delete (soft)", onSelect: onDelete, danger: true }
          ]}
        />
      </div>
      {categories.length > 0 ? (
        <div className="chip-row chip-row--static">
          {categories.map((category) => (
            <span key={category.id} className="chip chip--passive">{category.name}</span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function TopicCardPreview({
  topic,
  categories,
  compact,
  listMode,
  cardSettings
}: {
  topic: TopicEntity;
  categories: CategoryEntity[];
  compact: boolean;
  listMode: boolean;
  cardSettings: PageCardSettings;
}) {
  const previewText = getTopicPreviewText(topic);

  return (
    <article
      style={getTopicCardStyle(cardSettings, null, undefined, compact)}
      className={`surface-card topic-card ${listMode ? "topic-card--list" : ""} ${compact ? "topic-card--compact" : ""} topic-card--overlay surface-card--dragging`.trim()}
    >
      <div className="topic-card__header">
        <div className={`topic-card__title ${cardSettings.showPreviewContent ? "" : "topic-card__title--title-only"}`.trim()}>
          <h3>{topic.title}</h3>
          {cardSettings.showPreviewContent ? <p className="topic-card__preview">{previewText}</p> : null}
        </div>
      </div>
      {categories.length > 0 ? (
        <div className="chip-row chip-row--static">
          {categories.map((category) => (
            <span key={category.id} className="chip chip--passive">{category.name}</span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function getTopicPreviewText(topic: TopicEntity) {
  const markdownPreview = topic.bodyMarkdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[>#*_~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return [topic.summary, markdownPreview].filter(Boolean).join(" ") || "Open to add content.";
}

function getTopicGridStyle(cardSettings: PageCardSettings): CSSProperties {
  const gap = Math.max(5, Math.round(cardSettings.minWidthPx * 0.06));

  return {
    "--card-min-width": `${cardSettings.minWidthPx}px`,
    "--grid-gap": `${gap}px`
  } as CSSProperties;
}

function getTopicCardStyle(
  cardSettings: PageCardSettings,
  transform: { x: number; y: number; scaleX: number; scaleY: number } | null,
  transition: string | undefined,
  compact: boolean
): CSSProperties {
  const basePadding = Math.max(10, Math.round(cardSettings.minWidthPx * 0.08) - (compact ? 2 : 0));
  const innerGap = Math.max(10, Math.round(basePadding * 0.75));

  return {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    "--card-padding": `${basePadding}px`,
    "--card-inner-gap": `${innerGap}px`,
    "--card-preview-font-size": `${cardSettings.previewFontSizePx}px`,
    "--card-preview-lines": `${cardSettings.previewLines}`
  } as CSSProperties;
}