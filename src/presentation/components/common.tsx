import {
  type ButtonHTMLAttributes,
  type PropsWithChildren,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore
} from "react";
import { createPortal } from "react-dom";

const OVERLAY_BASE_Z_INDEX = 70;
const OVERLAY_Z_INDEX_STEP = 10;

let overlaySequence = 0;
let overlayStack: number[] = [];

interface BodyScrollLockState {
  overflow: string;
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  paddingRight: string;
  overscrollBehavior: string;
  scrollX: number;
  scrollY: number;
}

let lockedBodyState: BodyScrollLockState | null = null;

const overlayListeners = new Set<() => void>();

function emitOverlayChange() {
  overlayListeners.forEach((listener) => listener());
}

function subscribeToOverlayStack(listener: () => void) {
  overlayListeners.add(listener);

  return () => {
    overlayListeners.delete(listener);
  };
}

function getOverlayStackSnapshot() {
  return overlayStack;
}

function syncBodyScrollLock() {
  if (typeof document === "undefined") {
    return;
  }

  const { body, documentElement } = document;

  if (overlayStack.length > 0) {
    if (lockedBodyState === null) {
      lockedBodyState = {
        overflow: body.style.overflow,
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        paddingRight: body.style.paddingRight,
        overscrollBehavior: body.style.overscrollBehavior,
        scrollX: window.scrollX,
        scrollY: window.scrollY
      };
    }

    const scrollbarCompensation = Math.max(0, window.innerWidth - documentElement.clientWidth);

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${lockedBodyState.scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overscrollBehavior = "none";
    body.style.paddingRight = scrollbarCompensation > 0 ? `${scrollbarCompensation}px` : lockedBodyState.paddingRight;
    return;
  }

  if (lockedBodyState !== null) {
    const nextScrollX = lockedBodyState.scrollX;
    const nextScrollY = lockedBodyState.scrollY;

    body.style.overflow = lockedBodyState.overflow;
    body.style.position = lockedBodyState.position;
    body.style.top = lockedBodyState.top;
    body.style.left = lockedBodyState.left;
    body.style.right = lockedBodyState.right;
    body.style.width = lockedBodyState.width;
    body.style.paddingRight = lockedBodyState.paddingRight;
    body.style.overscrollBehavior = lockedBodyState.overscrollBehavior;
    lockedBodyState = null;

    try {
      window.scrollTo(nextScrollX, nextScrollY);
    } catch {
      // jsdom does not implement window.scrollTo.
    }
  }
}

function registerOverlay(id: number) {
  if (overlayStack.includes(id)) {
    return;
  }

  overlayStack = [...overlayStack, id];
  syncBodyScrollLock();
  emitOverlayChange();
}

function unregisterOverlay(id: number) {
  if (!overlayStack.includes(id)) {
    return;
  }

  overlayStack = overlayStack.filter((item) => item !== id);
  syncBodyScrollLock();
  emitOverlayChange();
}
interface OverlayPanelProps extends PropsWithChildren {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  className?: string;
  actions?: ReactNode;
  closeLabel?: string | null;
}

export function OverlayPanel({
  open,
  title,
  subtitle,
  onClose,
  className,
  actions,
  closeLabel = "Close",
  children
}: OverlayPanelProps) {
  const shouldCloseOnBackdropClickRef = useRef(false);
  const overlayIdRef = useRef<number | null>(null);
  const overlayStackSnapshot = useSyncExternalStore(
    subscribeToOverlayStack,
    getOverlayStackSnapshot,
    getOverlayStackSnapshot
  );

  if (overlayIdRef.current === null) {
    overlayIdRef.current = ++overlaySequence;
  }

  const stackIndex = overlayStackSnapshot.indexOf(overlayIdRef.current);
  const isTopmost = open && stackIndex === overlayStackSnapshot.length - 1;
  const overlayZIndex =
    stackIndex === -1
      ? OVERLAY_BASE_Z_INDEX
      : OVERLAY_BASE_Z_INDEX + stackIndex * OVERLAY_Z_INDEX_STEP;

  useLayoutEffect(() => {
    const overlayId = overlayIdRef.current;
    if (!open || overlayId === null) {
      return;
    }

    registerOverlay(overlayId);

    return () => {
      unregisterOverlay(overlayId);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !isTopmost) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (event.defaultPrevented || document.body.querySelector(".menu__content")) {
        return;
      }

      event.preventDefault();
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isTopmost, onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="overlay"
      role="presentation"
      style={{ zIndex: overlayZIndex }}
      onPointerDown={(event) => {
        if (!isTopmost) {
          shouldCloseOnBackdropClickRef.current = false;
          return;
        }

        shouldCloseOnBackdropClickRef.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (!isTopmost) {
          shouldCloseOnBackdropClickRef.current = false;
          return;
        }

        const shouldClose =
          shouldCloseOnBackdropClickRef.current && event.target === event.currentTarget;

        shouldCloseOnBackdropClickRef.current = false;
        if (shouldClose) {
          onClose();
        }
      }}
    >
      <section
        className={`overlay__panel ${className ?? ""}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="overlay__header">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <div className="overlay__actions">
            {actions}
            {closeLabel ? (
              <ActionButton type="button" variant="ghost" className="button--small overlay__close-button" onClick={onClose}>
                {closeLabel}
              </ActionButton>
            ) : null}
          </div>
        </header>
        <div className="overlay__body">{children}</div>
      </section>
    </div>,
    document.body
  );
}

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}

export function ActionButton({
  variant = "secondary",
  className,
  ...props
}: ActionButtonProps) {
  return <button className={`button button--${variant} ${className ?? ""}`.trim()} {...props} />;
}

export function SectionEmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="empty-state empty-state--section">
      <div className="empty-state__content">
        <h2>{title}</h2>
        <p>{description}</p>
        {action ? <div className="empty-state__actions">{action}</div> : null}
      </div>
    </section>
  );
}

export function FieldLabel({
  label,
  htmlFor,
  children
}: PropsWithChildren<{ label: string; htmlFor?: string }>) {
  return (
    <div className="field">
      {htmlFor ? (
        <label className="field__label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : (
        <span className="field__label">{label}</span>
      )}
      {children}
    </div>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  badge
}: {
  label: string;
  description: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <div className={`toggle-row ${disabled ? "toggle-row--disabled" : ""}`.trim()}>
      <div>
        <div className="toggle-row__title">
          <span>{label}</span>
          {badge ? <span className="soft-badge">{badge}</span> : null}
        </div>
        <p>{description}</p>
      </div>
      <button
        type="button"
        className={`toggle-switch ${checked ? "toggle-switch--checked" : ""}`.trim()}
        role="switch"
        aria-checked={checked ?? false}
        aria-label={label}
        onClick={() => onChange?.(!(checked ?? false))}
        disabled={disabled}
      >
        <span className="toggle-switch__track">
          <span className="toggle-switch__thumb" />
        </span>
      </button>
    </div>
  );
}

interface DropdownMenuItem {
  id: string;
  label: string;
  onSelect: () => void | Promise<void>;
  danger?: boolean;
  disabled?: boolean;
  selected?: boolean;
  keepOpen?: boolean;
}

interface MenuPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
  transformOrigin: string;
}

type MenuPlacement = "auto" | "top" | "bottom";

export function DropdownMenu({
  label,
  items,
  triggerLabel,
  triggerVariant = "icon",
  className,
  preferredPlacement = "auto",
  maxVisibleItems = 7
}: {
  label: string;
  items: DropdownMenuItem[];
  triggerLabel?: string;
  triggerVariant?: "icon" | "button";
  className?: string;
  preferredPlacement?: MenuPlacement;
  maxVisibleItems?: number;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const triggerRect = triggerRef.current?.getBoundingClientRect();
      if (!triggerRect) {
        return;
      }

      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const gap = 8;
      const edge = 12;
      const menuHeightLimit = Math.max(42, Math.min(viewportHeight - edge * 2, 16 + Math.max(1, maxVisibleItems) * 42));
      const desiredWidth = triggerVariant === "button" ? Math.max(triggerRect.width, 160) : 220;
      const measuredContentWidth = contentRef.current ? Math.ceil(contentRef.current.scrollWidth) : desiredWidth;
      const width = Math.min(
        Math.max(desiredWidth, measuredContentWidth),
        viewportWidth - edge * 2
      );
      const left = Math.min(
        Math.max(edge, triggerRect.right - width),
        Math.max(edge, viewportWidth - edge - width)
      );
      const availableBelow = Math.max(0, viewportHeight - triggerRect.bottom - gap - edge);
      const availableAbove = Math.max(0, triggerRect.top - gap - edge);
      const comfortableHeight = Math.min(menuHeightLimit, 180);
      const shouldOpenAbove =
        (preferredPlacement === "top" && (availableAbove >= 96 || availableAbove >= availableBelow)) ||
        (preferredPlacement !== "bottom" &&
          availableBelow < comfortableHeight &&
          availableAbove > availableBelow);

      if (!shouldOpenAbove) {
        setPosition({
          top: Math.max(edge, triggerRect.bottom + gap),
          left,
          width,
          maxHeight: Math.max(0, Math.min(menuHeightLimit, availableBelow)),
          transformOrigin: "top right"
        });
        return;
      }

      setPosition({
        bottom: Math.max(edge, viewportHeight - triggerRect.top + gap),
        left,
        width,
        maxHeight: Math.max(0, Math.min(menuHeightLimit, availableAbove)),
        transformOrigin: "bottom right"
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const isInsideTrigger = rootRef.current?.contains(target) ?? false;
      const isInsideContent = contentRef.current?.contains(target) ?? false;

      if (!isInsideTrigger && !isInsideContent) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    updatePosition();
    const animationFrameId = window.requestAnimationFrame(updatePosition);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
    };
  }, [maxVisibleItems, open, preferredPlacement, triggerVariant]);

  if (items.length === 0) {
    return null;
  }

  const stopEvent = (event: {
    stopPropagation: () => void;
    preventDefault?: () => void;
  }) => {
    event.stopPropagation();
  };

  const menuContent = open && position
    ? createPortal(
        <div
          ref={contentRef}
          className="menu__content"
          role="menu"
          aria-label={label}
          onClick={stopEvent}
          onMouseDown={stopEvent}
          onPointerDown={stopEvent}
          onTouchStart={stopEvent}
          style={{
            left: `${position.left}px`,
            top: position.top ? `${position.top}px` : undefined,
            bottom: position.bottom ? `${position.bottom}px` : undefined,
            width: `${position.width}px`,
            maxHeight: `${position.maxHeight}px`,
            transformOrigin: position.transformOrigin
          }}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitemcheckbox"
              aria-checked={item.selected ?? false}
              className={[
                item.danger ? "danger-text" : "",
                item.selected ? "menu__item--selected" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={item.disabled}
              onClick={async () => {
                if (!item.keepOpen) {
                  setOpen(false);
                }
                await item.onSelect();
              }}
            >
              <span className="menu__item-check" aria-hidden="true">{item.selected ? "x" : ""}</span>
              <span className="menu__item-label">{item.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )
    : null;

  return (
    <div
      ref={rootRef}
      className={`menu ${open ? "menu--open" : ""} ${className ?? ""}`.trim()}
      onClick={stopEvent}
      onMouseDown={stopEvent}
      onPointerDown={stopEvent}
      onTouchStart={stopEvent}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={
          triggerVariant === "button"
            ? "button button--secondary menu__trigger menu__trigger--button"
            : "icon-button icon-button--menu"
        }
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        {triggerVariant === "button" ? triggerLabel ?? label : "..."}
      </button>
      {menuContent}
    </div>
  );
}



