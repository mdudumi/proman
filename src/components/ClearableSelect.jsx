import { useRef } from "react";
import ClearButton from "./ClearButton";

/**
 * A plain <select> for short fixed lists, with the same ✕ to clear it as SearchSelect.
 * `onChange` receives the new value, and "" means nothing chosen.
 */
export default function ClearableSelect({ value, onChange, children }) {
  const selectRef = useRef(null);

  return (
    <div className={`select-field ${value ? "has-value" : ""}`}>
      <select ref={selectRef} value={value} onChange={e => onChange(e.target.value)}>
        {children}
      </select>

      {value && (
        <ClearButton
          onClear={() => {
            onChange("");
            selectRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}
