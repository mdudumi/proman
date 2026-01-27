import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function KategoriaAdmin() {
  const navigate = useNavigate();

  const [kategoria, setKategoria] = useState([]);
  const [selected, setSelected] = useState(null);

  const [newCat, setNewCat] = useState("");
  const [newItem, setNewItem] = useState("");

  const [editingCatId, setEditingCatId] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("kategoria")
      .select("id, name, kategoria_list(id, name)")
      .order("name");

    setKategoria(data || []);
    if (!selected && data?.length) setSelected(data[0]);
  }

  /* ---------- ADD ---------- */

  async function addCategory() {
    if (!newCat.trim()) return;
    await supabase.from("kategoria").insert({ name: newCat.trim() });
    setNewCat("");
    load();
  }

  async function addItem() {
    if (!newItem.trim() || !selected) return;
    await supabase.from("kategoria_list").insert({
      name: newItem.trim(),
      kategoria_id: selected.id,
    });
    setNewItem("");
    load();
  }

  /* ---------- EDIT ---------- */

  async function saveCategory(id) {
    if (!editValue.trim()) return;
    await supabase.from("kategoria").update({ name: editValue }).eq("id", id);
    setEditingCatId(null);
    setEditValue("");
    load();
  }

  async function saveItem(id) {
    if (!editValue.trim()) return;
    await supabase
      .from("kategoria_list")
      .update({ name: editValue })
      .eq("id", id);
    setEditingItemId(null);
    setEditValue("");
    load();
  }

  return (
    <div>
      {/* ===== TOP BAR ===== */}
      <div style={topBar}>
        <div>
          <h2 style={{ margin: 0 }}>Kategoria Management</h2>
          <div style={subtitle}>
            Admin / Master Data / Kategoria
          </div>
        </div>

        <button style={secondaryBtn} onClick={() => navigate("/dashboard")}>
          ← Dashboard
        </button>
      </div>

      {/* ===== CONTENT ===== */}
      <div style={grid}>
        {/* LEFT — CATEGORIES */}
        <div style={panel}>
          <div style={panelHeader}>
            <h3 style={panelTitle}>Categories</h3>
          </div>

          <div style={formRow}>
            <input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="Add new category"
              style={input}
            />
            <button style={primaryBtn} onClick={addCategory}>
              Add
            </button>
          </div>

          <div>
            {kategoria.map((k) => (
              <div
                key={k.id}
                style={{
                  ...row,
                  ...(selected?.id === k.id ? activeRow : {}),
                }}
                onClick={() => setSelected(k)}
                title="Double-click to edit"
                onDoubleClick={() => {
                  setEditingCatId(k.id);
                  setEditValue(k.name);
                }}
              >
                {editingCatId === k.id ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => saveCategory(k.id)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && saveCategory(k.id)
                    }
                    style={editInput}
                  />
                ) : (
                  k.name
                )}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — ITEMS */}
        <div style={panel}>
          <div style={panelHeader}>
            <h3 style={panelTitle}>
              {selected ? `Items — ${selected.name}` : "Items"}
            </h3>
            <div style={hint}>Double-click to edit</div>
          </div>

          {selected && (
            <div style={formRow}>
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="Add new item"
                style={input}
              />
              <button style={primaryBtn} onClick={addItem}>
                Add
              </button>
            </div>
          )}

          {!selected && (
            <div style={empty}>Select a category to manage items</div>
          )}

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
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => saveItem(i.id)}
                  onKeyDown={(e) => e.key === "Enter" && saveItem(i.id)}
                  style={editInput}
                />
              ) : (
                i.name
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
