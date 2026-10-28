import "./Loading.css";

// Placeholder bar widths in px for each kind of column, varied by row so the rows don't look like a grid.
// Fixed widths, not %: in a table sized by its content, a % bar would collapse to nothing or stretch the column.
const WIDTHS = {
  date: [72],
  text: [110, 80, 135, 95, 120],
  num: [70, 88, 60, 82, 74]
};

/** One shimmering bar standing in for content that is still loading. */
export function Skeleton({ width, height = 12, className = "" }) {
  return <span className={`skeleton ${className}`} style={{ width, height }} aria-hidden="true" />;
}

/**
 * Placeholder rows for a table body while its first rows load.
 * `columns` gives each column's kind: "date", "text", "num" (right-aligned), or "" for an empty cell.
 * `rowHeight` matches the real rows, so the table doesn't jump when they arrive.
 */
export function SkeletonRows({ rows, columns, rowHeight, label = "Duke ngarkuar…" }) {
  return Array.from({ length: rows }, (_, row) => (
    <tr key={row} className="skeletonRow" style={{ height: rowHeight }}>
      {columns.map((kind, col) => (
        <td key={col}>
          {row === 0 && col === 0 && <span className="sr-only" role="status">{label}</span>}
          {kind && (
            <Skeleton
              width={WIDTHS[kind][(row + col) % WIDTHS[kind].length]}
              className={kind === "num" ? "skeleton--end" : ""}
            />
          )}
        </td>
      ))}
    </tr>
  ));
}

/** A thin moving bar along the top of a table while data already on screen is being reloaded. */
export function RefreshBar({ active }) {
  return <div className={`refreshBar${active ? " is-active" : ""}`} aria-hidden="true" />;
}

/** A small spinning ring in the text colour, for buttons whose action is running. */
export function Spinner({ size = 14 }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}
