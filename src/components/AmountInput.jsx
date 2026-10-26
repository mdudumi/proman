import { useLayoutEffect, useRef } from "react";

// "10000.5" -> "10,000.5"
function formatAmount(raw) {
  const [whole, decimals] = String(raw ?? "").split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimals === undefined ? grouped : `${grouped}.${decimals}`;
}

// Keeps digits and the first dot only: "10,000.5" -> "10000.5"
function parseAmount(text) {
  const raw = text.replace(/[^\d.]/g, "");
  const dot = raw.indexOf(".");
  return dot === -1 ? raw : raw.slice(0, dot + 1) + raw.slice(dot + 1).replace(/\./g, "");
}

/**
 * A number field that shows thousands with commas while typing: 10000 shows as 10,000.
 * `value` and `onChange` use the plain number text ("10000.5"), so the form works with it as before.
 */
export default function AmountInput({ value, onChange, ...props }) {
  const inputRef = useRef(null);
  const caretRef = useRef(null);

  // Adding or removing a comma would throw the cursor to the end, so put it back
  // after the same digit it was after when the user typed.
  useLayoutEffect(() => {
    if (caretRef.current === null) return;
    const input = inputRef.current;
    let pos = 0;
    for (let seen = 0; pos < input.value.length && seen < caretRef.current; pos++) {
      if (input.value[pos] !== ",") seen++;
    }
    input.setSelectionRange(pos, pos);
    caretRef.current = null;
  });

  return (
    <input
      {...props}
      ref={inputRef}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={formatAmount(value)}
      onChange={e => {
        const { value: text, selectionStart } = e.target;
        caretRef.current = parseAmount(text.slice(0, selectionStart)).length;
        onChange(parseAmount(text));
      }}
    />
  );
}
