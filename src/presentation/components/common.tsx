import {
  type ButtonHTMLAttributes,
  type PropsWithChildren,
  type ReactNode,
  useEffect,
  useRef,
  useState
} from "react";

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

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="overlay"
      role="presentation"
      onPointerDown={(event) => {
        shouldCloseOnBackdropClickRef.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
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
    </div>
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

export function FieldLabel({ label, children }: PropsWithChildren<{ label: string }>) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
    </label>
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
  minWidth: number;
  maxHeight: number;
  transformOrigin: string;
}

export function DropdownMenu({
  label,
  items,
  triggerLabel,
  triggerVariant = "icon",
  className
}: {
  label: string;
  items: DropdownMenuItem[];
  triggerLabel?: string;
  triggerVariant?: "icon" | "button";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
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
      const desiredWidth = triggerVariant === "button" ? Math.max(triggerRect.width, 160) : 220;
      const minWidth = Math.min(desiredWidth, viewportWidth - edge * 2);
      const left = Math.min(
        Math.max(edge, triggerRect.right - minWidth),
        Math.max(edge, viewportWidth - edge - minWidth)
      );
      const availableBelow = Math.max(140, viewportHeight - triggerRect.bottom - gap - edge);
      const availableAbove = Math.max(140, triggerRect.top - gap - edge);

      if (availableBelow >= 180 || availableBelow >= availableAbove) {
        setPosition({
          top: Math.max(edge, triggerRect.bottom + gap),
          left,
          minWidth,
          maxHeight: availableBelow,
          transformOrigin: "top right"
        });
        return;
      }

      setPosition({
        bottom: Math.max(edge, viewportHeight - triggerRect.top + gap),
        left,
        minWidth,
        maxHeight: availableAbove,
        transformOrigin: "bottom right"
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    updatePosition();
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
    };
  }, [open, triggerVariant]);

  if (items.length === 0) {
    return null;
  }

  const stopEvent = (event: {
    stopPropagation: () => void;
    preventDefault?: () => void;
  }) => {
    event.stopPropagation();
  };

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
      {open ? (
        <div
          className="menu__content"
          role="menu"
          aria-label={label}
          style={
            position
              ? {
                  left: `${position.left}px`,
                  top: position.top ? `${position.top}px` : undefined,
                  bottom: position.bottom ? `${position.bottom}px` : undefined,
                  minWidth: `${position.minWidth}px`,
                  maxHeight: `${position.maxHeight}px`,
                  transformOrigin: position.transformOrigin
                }
              : undefined
          }
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
        </div>
      ) : null}
    </div>
  );
}
