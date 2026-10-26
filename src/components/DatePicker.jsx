import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./DatePicker.css";

const MONTHS = ["Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor", "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor"];
const WEEKDAYS = ["Hë", "Ma", "Më", "En", "Pr", "Sh", "Di"];

// The calendar renders in <body> so modals and cards with overflow: hidden don't cut it off.
// Like SearchSelect's list, it copies these colours from the field, so it matches the page it opened on.
const THEME_VARS = [
  "--select-menu-bg",
  "--select-text",
  "--select-border",
  "--select-muted",
  "--select-option-active",
  "--select-focus"
];

const PANEL_WIDTH = 296;
const PANEL_HEIGHT = 370;

const pad = n => String(n).padStart(2, "0");
const toIso = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;

// Today in local time, as "YYYY-MM-DD".
function todayIso() {
  const d = new Date();
  return toIso(d.getFullYear(), d.getMonth(), d.getDate());
}

// "2026-10-21" -> "21.10.2026"
function formatDate(iso) {
  const [year, month, day] = String(iso || "").split("-");
  return year && month && day ? `${day}.${month}.${year}` : "";
}

// "21.10.2026" or "1.2.2026" -> "YYYY-MM-DD"; null until the text is a full, real date.
function parseDate(text) {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);
  if (!match) return null;
  const [day, month, year] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return toIso(year, month - 1, day);
}

// Keeps typing in the dd.mm.yyyy shape: any separator becomes a dot, and the dot
// is added by itself once the day or month has two digits. "21102026" -> "21.10.2026".
function maskTyped(text) {
  const parts = [""];
  for (const ch of text) {
    const i = parts.length - 1;
    if (/\d/.test(ch)) {
      if (parts[i].length < (i < 2 ? 2 : 4)) parts[i] += ch;
      else if (i < 2) parts.push(ch);
    } else if (/[./\-\s,]/.test(ch) && i < 2 && parts[i]) {
      parts.push("");
    }
  }
  return parts.join(".");
}

// The month the calendar shows for a date, or for today when there's none.
function viewOf(iso) {
  const [year, month] = (iso || todayIso()).split("-").map(Number);
  return { year, month: month - 1 };
}

// Six full weeks starting on Monday, so the calendar keeps the same height every month.
function monthDays({ year, month }) {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(year, month, 1 - offset + i);
    return { iso: toIso(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), outside: d.getMonth() !== month };
  });
}

const Chevron = ({ direction }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={direction === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
  </svg>
);

/**
 * A date field: click it to pick from a calendar, or type the date (dd.mm.yyyy).
 * Works like <input type="date">: `value` and `onChange` use "YYYY-MM-DD", and "" means no date.
 * `clearable` lets the field be emptied, for filters where no date means every date.
 */
export default function DatePicker({ value, onChange, clearable = false, placeholder = "dd.mm.vvvv" }) {
  const [text, setText] = useState(() => formatDate(value));
  const [syncedValue, setSyncedValue] = useState(value);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("days");
  const [view, setView] = useState(() => viewOf(value));
  const [panelStyle, setPanelStyle] = useState(null);

  const fieldRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = useId();

  // A new value from outside (a reset button, a pick) replaces the text, unless the text already says that date.
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (parseDate(text) !== value) setText(formatDate(value));
  }

  const updatePosition = useCallback(() => {
    const field = fieldRef.current;
    if (!field) return;

    const rect = field.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < PANEL_HEIGHT && rect.top > spaceBelow;

    setPanelStyle(prev => ({
      ...prev,
      left,
      top: openUp ? "auto" : rect.bottom + 4,
      bottom: openUp ? window.innerHeight - rect.top + 4 : "auto"
    }));
  }, []);

  function openPanel() {
    const computed = getComputedStyle(fieldRef.current);
    const theme = Object.fromEntries(THEME_VARS.map(name => [name, computed.getPropertyValue(name)]));
    setPanelStyle({ ...theme, colorScheme: computed.colorScheme });
    updatePosition();

    setView(viewOf(parseDate(text) || value));
    setMode("days");
    setOpen(true);
  }

  function change(next) {
    if (next !== value) onChange(next);
  }

  function choose(iso) {
    setText(formatDate(iso));
    change(iso);
    setOpen(false);
  }

  function clear() {
    setText("");
    change("");
    setOpen(false);
  }

  // Leaving the field tidies a full date ("1.2.2026" -> "01.02.2026") and puts back the last good one otherwise.
  function commit() {
    const iso = parseDate(text);
    if (iso) {
      setText(formatDate(iso));
      change(iso);
    } else if (!text && clearable) {
      change("");
    } else {
      setText(formatDate(value));
    }
  }

  function onType(e) {
    const next = maskTyped(e.target.value);
    setText(next);

    const iso = parseDate(next);
    if (iso) {
      change(iso);
      setView(viewOf(iso));
      setMode("days");
    } else if (!next && clearable) {
      change("");
    }
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown" && !open) {
      e.preventDefault();
      openPanel();
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      commit();
      setOpen(false);
    }
  }

  // Previous / next month, or year in the month view.
  function step(delta) {
    setView(v => {
      if (mode === "months") return { ...v, year: v.year + delta };
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  // While open, follow the field when the page or a modal scrolls.
  useEffect(() => {
    if (!open) return;

    function onScroll(e) {
      if (panelRef.current?.contains(e.target)) return;
      updatePosition();
    }

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  const today = todayIso();

  return (
    <div ref={fieldRef} className="dp-field">
      <input
        ref={inputRef}
        className="dp-input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onChange={onType}
        onKeyDown={onKeyDown}
        onClick={e => {
          // The first click opens the calendar and selects the date, so typing replaces it.
          if (open) return;
          openPanel();
          e.currentTarget.select();
        }}
        onBlur={() => {
          commit();
          setOpen(false);
        }}
      />

      {/* Clicks inside the field and calendar keep the focus in the input, so typing still works. */}
      <button
        type="button"
        className="dp-toggle"
        tabIndex={-1}
        aria-label="Hap kalendarin"
        onMouseDown={e => e.preventDefault()}
        onClick={() => {
          if (open) return setOpen(false);
          inputRef.current?.focus();
          openPanel();
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>

      {open && panelStyle && createPortal(
        <div
          ref={panelRef}
          id={panelId}
          className="dp-panel"
          style={panelStyle}
          role="dialog"
          aria-label="Zgjidh datën"
          onMouseDown={e => e.preventDefault()}
        >
          <div className="dp-head">
            <button type="button" className="dp-btn dp-nav" aria-label="Para" onClick={() => step(-1)}>
              <Chevron direction="left" />
            </button>
            <button
              type="button"
              className="dp-btn dp-title"
              onClick={() => setMode(m => (m === "days" ? "months" : "days"))}
            >
              {mode === "days" ? `${MONTHS[view.month]} ${view.year}` : view.year}
            </button>
            <button type="button" className="dp-btn dp-nav" aria-label="Pas" onClick={() => step(1)}>
              <Chevron direction="right" />
            </button>
          </div>

          {mode === "days" ? (
            <div className="dp-grid">
              {WEEKDAYS.map(name => (
                <span key={name} className="dp-weekday">{name}</span>
              ))}
              {monthDays(view).map(day => (
                <button
                  key={day.iso}
                  type="button"
                  className={[
                    "dp-btn",
                    "dp-day",
                    day.outside ? "is-outside" : "",
                    day.iso === today ? "is-today" : "",
                    day.iso === value ? "is-selected" : ""
                  ].join(" ")}
                  aria-label={formatDate(day.iso)}
                  aria-pressed={day.iso === value}
                  onClick={() => choose(day.iso)}
                >
                  {day.day}
                </button>
              ))}
            </div>
          ) : (
            <div className="dp-months">
              {MONTHS.map((name, month) => (
                <button
                  key={name}
                  type="button"
                  className={`dp-btn dp-month ${month === view.month ? "is-selected" : ""}`}
                  onClick={() => {
                    setView(v => ({ ...v, month }));
                    setMode("days");
                  }}
                >
                  {name.slice(0, 3)}
                </button>
              ))}
            </div>
          )}

          <div className="dp-foot">
            <button type="button" className="dp-btn dp-link" onClick={() => choose(today)}>
              Sot
            </button>
            {clearable && (
              <button type="button" className="dp-btn dp-link" onClick={clear}>
                Pastro
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
