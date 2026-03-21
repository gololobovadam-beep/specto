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
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from "react";
import { useNavigate } from "react-router-dom";
import type { PageEntity, TopicEntity } from "../../domain/models";
import { ActionButton, DropdownMenu, FieldLabel, OverlayPanel, SectionEmptyState } from "../components/common";
import { LONG_PRESS_DELAY_MS, RightClickMouseSensor, TouchSensor } from "../dnd/longPressSensors";
import { useWorkspace } from "../state/WorkspaceProvider";

export function PagesHubScreen() {
  const navigate = useNavigate();
  const {
    snapshot,
    createPage,
    openPageTab,
    renamePage,
    softDeletePage,
    reorderPages,
    setPageViewMode
  } = useWorkspace();

  const pages = useMemo(() => snapshot.pages.filter((page) => !page.deletedAt), [snapshot.pages]);
  const visibleTopics = useMemo(() => snapshot.topics.filter((topic) => !topic.deletedAt), [snapshot.topics]);
  const [orderedPageIds, setOrderedPageIds] = useState<string[]>([]);
  const [activeDragPageId, setActiveDragPageId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [renameTarget, setRenameTarget] = useState<PageEntity | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    setOrderedPageIds(pages.map((page) => page.id));
  }, [pages]);

  const orderedPages = useMemo(() => {
    const pageMap = new Map(pages.map((page) => [page.id, page]));
    const arranged = orderedPageIds.flatMap((pageId) => {
      const page = pageMap.get(pageId);
      return page ? [page] : [];
    });
    const arrangedIds = new Set(arranged.map((page) => page.id));
    return [...arranged, ...pages.filter((page) => !arrangedIds.has(page.id))];
  }, [orderedPageIds, pages]);

  const activeDragPage = orderedPages.find((page) => page.id === activeDragPageId) ?? null;

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

  async function handleOpenPage(pageId: string) {
    await openPageTab(pageId);
    navigate(`/pages/${pageId}`);
  }

  async function handleCreatePage(event: FormEvent) {
    event.preventDefault();
    const nextSnapshot = await createPage(draftTitle || undefined);
    setCreateOpen(false);
    setDraftTitle("");

    if (nextSnapshot.session.activeTabId) {
      navigate(`/pages/${nextSnapshot.session.activeTabId}`);
    }
  }

  async function handleRenamePage(event: FormEvent) {
    event.preventDefault();
    if (!renameTarget) {
      return;
    }

    await renamePage(renameTarget.id, renameValue);
    setRenameTarget(null);
    setRenameValue("");
  }

  async function handleDeletePage(pageId: string) {
    if (!window.confirm("Delete this page? It will be kept as a soft-deleted item.")) {
      return;
    }

    await softDeletePage(pageId);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragPageId(String(event.active.id));
  }

  function handleDragCancel() {
    setActiveDragPageId(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragPageId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = orderedPages.findIndex((page) => page.id === active.id);
    const newIndex = orderedPages.findIndex((page) => page.id === over.id);
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const nextOrder = arrayMove(orderedPages, oldIndex, newIndex).map((page) => page.id);
    setOrderedPageIds(nextOrder);
    void reorderPages(nextOrder);
  }

  const createButton = (
    <ActionButton type="button" variant="primary" onClick={() => setCreateOpen(true)}>
      New page
    </ActionButton>
  );

  return (
    <>
      <section className="page-section page-section--hub">
        <div className="page-section__header">
          <div>
            <p className="eyebrow">Pages hub</p>
            <h1>Your study pages</h1>
          </div>
          {createButton}
        </div>

        {orderedPages.length === 0 ? (
          <SectionEmptyState
            title="No pages yet"
            description="Create your first page. It will immediately become a real tab and open as your working space."
            action={createButton}
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragCancel={handleDragCancel}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={orderedPages.map((page) => page.id)} strategy={rectSortingStrategy}>
              <div className="page-grid">
                {orderedPages.map((page) => (
                  <SortablePageCard
                    key={page.id}
                    page={page}
                    topics={visibleTopics.filter((topic) => topic.pageId === page.id)}
                    showTopicCount={snapshot.settings.showTopicCounters}
                    onOpen={() => handleOpenPage(page.id)}
                    onRename={() => {
                      setRenameTarget(page);
                      setRenameValue(page.title);
                    }}
                    onDelete={() => handleDeletePage(page.id)}
                    onSetGrid={() => setPageViewMode(page.id, "grid")}
                    onSetList={() => setPageViewMode(page.id, "list")}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeDragPage ? (
                <PageCardPreview
                  page={activeDragPage}
                  topics={visibleTopics.filter((topic) => topic.pageId === activeDragPage.id)}
                  showTopicCount={snapshot.settings.showTopicCounters}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </section>

      <OverlayPanel
        open={createOpen}
        title="Create a new page"
        subtitle="This page will become a real tab immediately after creation."
        onClose={() => setCreateOpen(false)}
      >
        <form className="stack-form" onSubmit={handleCreatePage}>
          <FieldLabel label="Page title">
            <input
              autoFocus
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder="Python core"
            />
          </FieldLabel>
          <div className="form-actions">
            <ActionButton type="button" onClick={() => setCreateOpen(false)}>
              Cancel
            </ActionButton>
            <ActionButton type="submit" variant="primary">
              Create page
            </ActionButton>
          </div>
        </form>
      </OverlayPanel>

      <OverlayPanel
        open={Boolean(renameTarget)}
        title="Edit page"
        subtitle="Update the tab label and page title together."
        onClose={() => setRenameTarget(null)}
      >
        <form className="stack-form" onSubmit={handleRenamePage}>
          <FieldLabel label="Page title">
            <input
              autoFocus
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              placeholder="Advanced decorators"
            />
          </FieldLabel>
          <div className="form-actions">
            <ActionButton type="button" onClick={() => setRenameTarget(null)}>
              Cancel
            </ActionButton>
            <ActionButton type="submit" variant="primary">
              Save title
            </ActionButton>
          </div>
        </form>
      </OverlayPanel>
    </>
  );
}

function SortablePageCard({
  page,
  topics,
  showTopicCount,
  onOpen,
  onRename,
  onDelete,
  onSetGrid,
  onSetList
}: {
  page: PageEntity;
  topics: TopicEntity[];
  showTopicCount: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onSetGrid: () => void;
  onSetList: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };
  const topicPreview = topics.slice(0, 4).map((topic) => topic.title).join(" / ");
  const menuItems = [
    { id: "edit", label: "Edit", onSelect: onRename },
    ...(page.preferredViewMode === "grid"
      ? [{ id: "show-list", label: "Show topics as list", onSelect: onSetList }]
      : [{ id: "show-cards", label: "Show topics as cards", onSelect: onSetGrid }]),
    { id: "delete", label: "Delete (soft)", onSelect: onDelete, danger: true }
  ];

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
      style={style}
      className={`surface-card page-card page-card--interactive ${isDragging ? "surface-card--dragging" : ""}`.trim()}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      onContextMenu={(event) => event.preventDefault()}
      {...attributes}
      {...listeners}
    >
      <div className="page-card__row">
        <div className="page-card__content">
          <div className="page-card__meta">
            <span className="soft-badge">{page.preferredViewMode === "grid" ? "Cards" : "List"}</span>
            {showTopicCount ? <span className="soft-badge">{topics.length} topics</span> : null}
          </div>
          <h3>{page.title}</h3>
          <p>{topicPreview || "No topics yet. Open the page to create your first study item."}</p>
        </div>
        <DropdownMenu label={`Page actions for ${page.title}`} items={menuItems} />
      </div>
    </article>
  );
}

function PageCardPreview({
  page,
  topics,
  showTopicCount
}: {
  page: PageEntity;
  topics: TopicEntity[];
  showTopicCount: boolean;
}) {
  const topicPreview = topics.slice(0, 4).map((topic) => topic.title).join(" / ");

  return (
    <article className="surface-card page-card page-card--overlay surface-card--dragging">
      <div className="page-card__row">
        <div className="page-card__content">
          <div className="page-card__meta">
            <span className="soft-badge">{page.preferredViewMode === "grid" ? "Cards" : "List"}</span>
            {showTopicCount ? <span className="soft-badge">{topics.length} topics</span> : null}
          </div>
          <h3>{page.title}</h3>
          <p>{topicPreview || "No topics yet. Open the page to create your first study item."}</p>
        </div>
      </div>
    </article>
  );
}