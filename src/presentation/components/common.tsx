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
}

export function OverlayPanel({
  open,
  title,
  subtitle,
  onClose,
  className,
  children
}: OverlayPanelProps) {
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
    <div className="overlay" role="presentation" onClick={onClose}>
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
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close panel">
            x
          </button>
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
}

export function DropdownMenu({
  label,
  items
}: {
  label: string;
  items: DropdownMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

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

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

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
      className={`menu ${open ? "menu--open" : ""}`.trim()}
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
        type="button"
        className="icon-button icon-button--menu"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        ...
      </button>
      {open ? (
        <div className="menu__content" role="menu" aria-label={label}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={item.danger ? "danger-text" : undefined}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                void item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}