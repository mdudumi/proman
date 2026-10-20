import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./SearchSelect.css";

// The list renders in <body> so modals and cards with overflow: hidden don't cut it off.
// It copies these colours from the closed dropdown, so it matches the page it opened on.
const THEME_VARS = [
  "--select-menu-bg",
  "--select-text",
  "--select-border",
  "--select-muted",
  "--select-option-active",
  "--select-focus",
  "--select-focus-ring"
];

const PANEL_MAX_HEIGHT = 320;
const PANEL_MIN_WIDTH = 240;

// Lower case without accents, so "bleres" finds "Blerës" and "cmim" finds "Çmim".
const normalize = text =>
  String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * A dropdown with a search box. Works like <select>: `value` is the
 * chosen row's id, "" means nothing chosen, and `onChange` receives the new id.
 * `options` is a list of { id, name } rows, as they come from Supabase.
 */
export default function SearchSelect({
  value,
  onChange,
  options,
  placeholder = "Select",
  disabled = false
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [panelStyle, setPanelStyle] = useState(null);

  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  const selected = options.find(o => String(o.id) === String(value));

  // The empty choice ("All", "Select") comes first, and only when not searching.
  const visibleOptions = useMemo(() => {
    const q = normalize(query.trim());
    if (q) return options.filter(o => normalize(o.name).includes(q));
    return [{ id: "", name: placeholder }, ...options];
  }, [options, placeholder, query]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, PANEL_MIN_WIDTH);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < PANEL_MAX_HEIGHT && rect.top > spaceBelow;

    setPanelStyle(prev => ({
      ...prev,
      left,
      width,
      top: openUp ? "auto" : rect.bottom + 4,
      bottom: openUp ? window.innerHeight - rect.top + 4 : "auto"
    }));
  }, []);

  function openList(initialQuery = "") {
    if (disabled) return;

    const computed = getComputedStyle(triggerRef.current);
    const theme = Object.fromEntries(THEME_VARS.map(name => [name, computed.getPropertyValue(name)]));
    setPanelStyle({ ...theme, colorScheme: computed.colorScheme });
    updatePosition();

    setQuery(initialQuery);
    setActiveIndex(
      initialQuery ? 0 : Math.max(0, options.findIndex(o => String(o.id) === String(value)) + 1)
    );
    setOpen(true);
  }

  function close(returnFocus) {
    setOpen(false);
    setQuery("");
    if (returnFocus) triggerRef.current?.focus();
  }

  function choose(option) {
    // Like <select>, picking the current value again is not a change.
    if (String(option.id) !== String(value ?? "")) onChange(option.id);
    close(true);
  }

  // While open: focus the search box, follow the dropdown when the page scrolls, close on outside clicks.
  useEffect(() => {
    if (!open) return;

    inputRef.current?.focus({ preventScroll: true });

    function onPointerDown(e) {
      if (triggerRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return;
      setOpen(false);
      setQuery("");
    }

    // Scrolling the list itself doesn't move the dropdown.
    function onScroll(e) {
      if (panelRef.current?.contains(e.target)) return;
      updatePosition();
    }

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", updatePosition);
    document.addEventListener("mousedown", onPointerDown);

    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", updatePosition);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, updatePosition]);

  // Keep the highlighted option in view while moving with the arrow keys.
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function onTriggerKeyDown(e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openList();
    } else if (e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Typing on the closed dropdown opens it and starts the search.
      e.preventDefault();
      openList(e.key);
    }
  }

  function onSearchKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, visibleOptions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (visibleOptions[activeIndex]) choose(visibleOptions[activeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === "Tab") {
      // Focus goes back to the dropdown first, so Tab continues to the next field.
      close(true);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="ss-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="ss-value">
          {selected ? selected.name : placeholder}
        </span>
      </button>

      {open && panelStyle && createPortal(
        <div ref={panelRef} className="ss-panel" style={panelStyle}>
          <input
            ref={inputRef}
            className="ss-search"
            type="text"
            value={query}
            placeholder="Kërko…"
            aria-label="Kërko"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={visibleOptions[activeIndex] ? `${listId}-${activeIndex}` : undefined}
            autoComplete="off"
            onChange={e => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onSearchKeyDown}
          />

          <ul ref={listRef} id={listId} className="ss-list" role="listbox">
            {visibleOptions.map((option, index) => (
              <li
                key={option.id === "" ? "__empty" : option.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={String(option.id) === String(value ?? "")}
                className={[
                  "ss-option",
                  index === activeIndex ? "is-active" : "",
                  String(option.id) === String(value ?? "") ? "is-selected" : ""
                ].join(" ")}
                onMouseDown={e => e.preventDefault()}
                onMouseMove={() => setActiveIndex(index)}
                onClick={() => choose(option)}
              >
                {option.name}
              </li>
            ))}
          </ul>

          {visibleOptions.length === 0 && <div className="ss-empty">Asnjë rezultat</div>}
        </div>,
        document.body
      )}
    </>
  );
}
