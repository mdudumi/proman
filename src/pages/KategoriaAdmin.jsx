import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Skeleton, Spinner } from "../components/Loading";

// Placeholder rows for the first load: name bar widths, varied so they don't look like a grid.
const SKELETON_WIDTHS = [120, 90, 150, 105, 135, 80];

export default function KategoriaAdmin() {
  const navigate = useNavigate();

  const [kategoria, setKategoria] = useState([]);
  const [selected, setSelected] = useState(null);

  const [newCat, setNewCat] = useState("");
  const [newItem, setNewItem] = useState("");

  const [editingCatId, setEditingCatId] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editValue, setEditValue] = useState("");

  // False until the first answer: until then placeholder rows stand in for both lists.
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  // The change being saved, for example "add-category" or "delete-<id>": its button shows that
  // it's working, and the other changes wait until it's saved and the list reloaded.
  const [busy, setBusy] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load(selectedId = selected?.id) {
    const { data, error } = await supabase
      .from("kategoria")
      .select("id, name, kategoria_list(id, name, kategoria_id)")
      .order("name");

    setHasLoaded(true);

    if (error) {
      console.error(error);
      setLoadError(error.message);
      return;
    }

    setLoadError("");
    const rows = data || [];
    setKategoria(rows);

    if (!rows.length) {
      setSelected(null);
      return;
    }

    if (selectedId) {
      const stillSelected = rows.find((x) => x.id === selectedId);
      setSelected(stillSelected || rows[0]);
    } else {
      setSelected(rows[0]);
    }
  }

  async function change(name, action) {
    if (busy) return;
    setBusy(name);
    try {
      await action();
    } finally {
      setBusy("");
    }
  }

  function addCategory() {
    if (!newCat.trim()) return;

    return change("add-category", async () => {
      const { error } = await supabase.from("kategoria").insert({
        name: newCat.trim(),
      });

      if (error) {
        alert(error.message);
        return;
      }

      setNewCat("");
      await load();
    });
  }

  function addItem() {
    if (!newItem.trim() || !selected) return;

    return change("add-item", async () => {
      const { error } = await supabase.from("kategoria_list").insert({
        name: newItem.trim(),
        kategoria_id: selected.id,
      });

      if (error) {
        alert(error.message);
        return;
      }

      setNewItem("");
      await load(selected.id);
    });
  }

  function saveCategory(id) {
    if (!editValue.trim()) return;

    return change(`rename-${id}`, async () => {
      const { error } = await supabase
        .from("kategoria")
        .update({ name: editValue.trim() })
        .eq("id", id);

      if (error) {
        alert(error.message);
        return;
      }

      setEditingCatId(null);
      setEditValue("");
      await load(id);
    });
  }

  function saveItem(id) {
    if (!editValue.trim()) return;

    return change(`rename-${id}`, async () => {
      const { error } = await supabase
        .from("kategoria_list")
        .update({ name: editValue.trim() })
        .eq("id", id);

      if (error) {
        alert(error.message);
        return;
      }

      setEditingItemId(null);
      setEditValue("");
      await load(selected?.id);
    });
  }

  function deleteCategory(cat) {
    if (!cat || busy) return;

    const confirmed = window.confirm(
      `A je i sigurt që do fshish kategorinë "${cat.name}"?`
    );
    if (!confirmed) return;

    return change(`delete-${cat.id}`, async () => {
      const { error: itemsError } = await supabase
        .from("kategoria_list")
        .delete()
        .eq("kategoria_id", cat.id);

      if (itemsError) {
        alert(itemsError.message);
        return;
      }

      const { error } = await supabase
        .from("kategoria")
        .delete()
        .eq("id", cat.id);

      if (error) {
        alert(error.message);
        return;
      }

      if (selected?.id === cat.id) {
        setSelected(null);
      }

      await load(selected?.id === cat.id ? null : selected?.id);
    });
  }

  function deleteItem(item) {
    if (!item || busy) return;

    const confirmed = window.confirm(
      `A je i sigurt që do fshish "${item.name}"?`
    );
    if (!confirmed) return;

    return change(`delete-${item.id}`, async () => {
      const { error } = await supabase
        .from("kategoria_list")
        .delete()
        .eq("id", item.id);

      if (error) {
        alert(error.message);
        return;
      }

      await load(selected?.id);
    });
  }

  // A button that starts a change: disabled while any change is saving, with a spinner on the one that is.
  function changeButton(name, style, label, onClick) {
    return (
      <button
        style={{ ...style, ...(busy ? busyBtn : {}) }}
        disabled={Boolean(busy)}
        onClick={onClick}
      >
        {busy === name && <Spinner size={12} />}
        {label}
      </button>
    );
  }

  // `status` tells screen readers it's loading, once for the page.
  const skeletonRows = (status) => SKELETON_WIDTHS.map((width, i) => (
    <div key={i} style={row}>
      <div style={rowContent}>
        {status && i === 0 && <span className="sr-only" role="status">Duke ngarkuar…</span>}
        <Skeleton width={width} height={14} />
        <Skeleton width={46} height={28} />
      </div>
    </div>
  ));

  return (
    <div>
      {loadError && (
        <div style={errorBox}>
          Të dhënat nuk u ngarkuan: {loadError}
          {changeButton("reload", secondaryBtn, "Provo përsëri", () => change("reload", () => load()))}
        </div>
      )}

      <div style={grid}>
        <div style={panel}>
          <div style={panelHeader}>
            <h3 style={panelTitle}>Kategoritë</h3>
          </div>

          <div style={formRow}>
            <input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="Shto Kategori"
              style={input}
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
            />
            {changeButton("add-category", primaryBtn, "Shto", addCategory)}
          </div>

          <div aria-busy={!hasLoaded}>
            {!hasLoaded && skeletonRows(true)}

            {kategoria.map((k) => (
              <div
                key={k.id}
                style={{
                  ...row,
                  ...(selected?.id === k.id ? activeRow : {}),
                }}
                onClick={() => setSelected(k)}
                onDoubleClick={() => {
                  setEditingCatId(k.id);
                  setEditValue(k.name);
                }}
              >
                {editingCatId === k.id ? (
                  <input
                    autoFocus
                    value={editValue}
                    readOnly={busy === `rename-${k.id}`}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => saveCategory(k.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveCategory(k.id);
                      if (e.key === "Escape") {
                        setEditingCatId(null);
                        setEditValue("");
                      }
                    }}
                    style={{ ...editInput, ...(busy === `rename-${k.id}` ? busyBtn : {}) }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div style={rowContent}>
                    <span>{k.name}</span>
                    {changeButton(`delete-${k.id}`, dangerBtn, "Fshi", (e) => {
                      e.stopPropagation();
                      deleteCategory(k);
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={panel}>
          <div style={panelHeader}>
            <h3 style={panelTitle}>
              {selected ? `Elementi — ${selected.name}` : hasLoaded ? "Items" : <Skeleton width={180} height={16} />}
            </h3>
          </div>

          {selected && (
            <div style={formRow}>
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="Shto element"
                style={input}
                onKeyDown={(e) => e.key === "Enter" && addItem()}
              />
              {changeButton("add-item", primaryBtn, "Shto", addItem)}
            </div>
          )}

          {hasLoaded && !selected && (
            <div style={empty}>Select a category to manage items</div>
          )}

          {!hasLoaded && <div aria-busy="true">{skeletonRows(false)}</div>}

          {selected?.kategoria_list?.map((i) => (
            <div
              key={i.id}
              style={row}
              onDoubleClick={() => {
                setEditingItemId(i.id);
                setEditValue(i.name);
              }}
            >
              {editingItemId === i.id ? (
                <input
                  autoFocus
                  value={editValue}
                  readOnly={busy === `rename-${i.id}`}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => saveItem(i.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveItem(i.id);
                    if (e.key === "Escape") {
                      setEditingItemId(null);
                      setEditValue("");
                    }
                  }}
                  style={{ ...editInput, ...(busy === `rename-${i.id}` ? busyBtn : {}) }}
                />
              ) : (
                <div style={rowContent}>
                  <span>{i.name}</span>
                  {changeButton(`delete-${i.id}`, dangerBtn, "Fshi", () => deleteItem(i))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const topBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 20,
};

const subtitle = {
  fontSize: 13,
  color: "var(--muted)",
  marginTop: 4,
};

const grid = {
  display: "grid",
  gridTemplateColumns: "280px 1fr",
  gap: 20,
};

const panel = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: 16,
};

const panelHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
};

const panelTitle = {
  margin: 0,
  fontSize: 16,
  fontWeight: 700,
};

const hint = {
  fontSize: 12,
  color: "var(--muted)",
};

const formRow = {
  display: "flex",
  gap: 8,
  marginBottom: 14,
};

const input = {
  flex: 1,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "#0f1325",
  color: "var(--text)",
};

const editInput = {
  width: "100%",
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid var(--accent)",
  background: "#0f1325",
  color: "var(--text)",
};

const row = {
  padding: "8px 10px",
  borderRadius: 8,
  cursor: "pointer",
  marginBottom: 4,
  transition: "background 0.15s",
};

const rowContent = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const activeRow = {
  background: "rgba(79,124,255,0.18)",
};

const empty = {
  fontSize: 13,
  color: "var(--muted)",
  padding: 10,
};

const primaryBtn = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryBtn = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text)",
  cursor: "pointer",
  fontWeight: 600,
};

const dangerBtn = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "#7f1d1d",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 12,
};

/* While a change is saving */
const busyBtn = {
  opacity: 0.6,
  cursor: "progress",
};

const errorBox = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 16,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,138,138,0.35)",
  background: "rgba(127,29,29,0.18)",
  color: "#ff8a8a",
  fontSize: 13,
};
