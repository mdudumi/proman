// The ✕ inside a dropdown that has a value; clicking it empties the dropdown.
// Styled in styles.css (.select-clear). It's skipped by Tab, so it doesn't slow down filling a form.
export default function ClearButton({ onClear }) {
  return (
    <button
      type="button"
      className="select-clear"
      tabIndex={-1}
      aria-label="Pastro"
      title="Pastro"
      onMouseDown={e => e.preventDefault()}
      onClick={onClear}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  );
}
