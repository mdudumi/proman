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

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load(selectedId = selected?.id) {
    setLoading(true);

    const { data, error } = await supabase
      .from("kategoria")
      .select("id, name, kategoria_list(id, name, kategoria_id)")
      .order("name");

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const rows = data || [];
    setKategoria(rows);

    if (!rows.length) {
      setSelected(null);
      setLoading(false);
      return;
    }

    if (selectedId) {
      const stillSelected = rows.find((x) => x.id === selectedId);
      setSelected(stillSelected || rows[0]);
    } else {
      setSelected(rows[0]);
    }

    setLoading(false);
  }

  async function addCategory() {
    if (!newCat.trim()) return;

    const { error } = await supabase.from("kategoria").insert({
      name: newCat.trim(),
    });

    if (error) {
      alert(error.message);
      return;
    }

    setNewCat("");
    load();
  }

  async function addItem() {
    if (!newItem.trim() || !selected) return;

    const { error } = await supabase.from("kategoria_list").insert({
      name: newItem.trim(),
      kategoria_id: selected.id,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setNewItem("");
    load(selected.id);
  }

  async function saveCategory(id) {
    if (!editValue.trim()) return;

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
    load(id);
  }

  async function saveItem(id) {
    if (!editValue.trim()) return;

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
    load(selected?.id);
  }

  async function deleteCategory(cat) {
    if (!cat) return;

    const confirmed = window.confirm(
      `A je i sigurt që do fshish kategorinë "${cat.name}"?`
    );
    if (!confirmed) return;

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

    load();
  }

  async function deleteItem(item) {
    if (!item) return;

    const confirmed = window.confirm(
      `A je i sigurt që do fshish "${item.name}"?`
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from("kategoria_list")
      .delete()
      .eq("id", item.id);

    if (error) {
      alert(error.message);
      return;
    }

    load(selected?.id);
  }

  return (
    <div>
      <div style={topBar}>
        <div>
          <h2 style={{ margin: 0 }}>Menxhimi i Kategorisë</h2>
        </div>
      </div>

      <div style={grid}>
        <div style={panel}>
          <div style={panelHeader}>
            <h3 style={panelTitle}>Categories</h3>
          </div>

          <div style={formRow}>
            <input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="Shto Kategori"
              style={input}
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
            />
            <button style={primaryBtn} onClick={addCategory}>
              Shto
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
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveCategory(k.id);
                      if (e.key === "Escape") {
                        setEditingCatId(null);
                        setEditValue("");
                      }
                    }}
                    style={editInput}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div style={rowContent}>
                    <span>{k.name}</span>
                    <button
                      style={dangerBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCategory(k);
                      }}
                    >
                      Fshi
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div style={panel}>
          <div style={panelHeader}>
            <h3 style={panelTitle}>
              {selected ? `Items — ${selected.name}` : "Items"}
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
              <button style={primaryBtn} onClick={addItem}>
                Shto
              </button>
            </div>
          )}

          {!selected && (
            <div style={empty}>Select a category to manage items</div>
          )}

          {loading && <div style={empty}>Duke ngarkuar...</div>}

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
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveItem(i.id);
                    if (e.key === "Escape") {
                      setEditingItemId(null);
                      setEditValue("");
                    }
                  }}
                  style={editInput}
                />
              ) : (
                <div style={rowContent}>
                  <span>{i.name}</span>
                  <button
                    style={dangerBtn}
                    onClick={() => deleteItem(i)}
                  >
                    Fshi
                  </button>
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
