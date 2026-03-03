import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { CATEGORY_IDS } from "../lib/categoryIds";
import Modal from "./Modal";
import DitorForm from "./DitorForm";
import "./DitorTable.css";

export default function DitorTable() {
  const [rows, setRows] = useState([]);
  const [editRow, setEditRow] = useState(null);

  /* ================= FILTER STATE ================= */

  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
    kategoria_id: "",
    produkti_id: "",
    monedha_id: "",
    bleresi_id: "",
    veprimi: ""
  });

  /* ================= LOOKUPS FOR FILTERS ================= */

  const [kategorite, setKategorite] = useState([]);
  const [produkte, setProdukte] = useState([]);
  const [monedha, setMonedha] = useState([]);
  const [bleresit, setBleresit] = useState([]);

  /* ================= LOAD LOOKUPS ================= */

  // Load categories (once)
  useEffect(() => {
    supabase
      .from("kategoria")
      .select("id,name")
      .order("name")
      .then(({ data, error }) => {
        if (error) console.error(error);
        setKategorite(data || []);
      });
  }, []);

  // Load currency + buyers/sellers (once)
  useEffect(() => {
    supabase
      .from("kategoria_list")
      .select("id,name")
      .eq("kategoria_id", CATEGORY_IDS.MONEDHA)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data, error }) => {
        if (error) console.error(error);
        setMonedha(data || []);
      });

    supabase
      .from("kategoria_list")
      .select("id,name")
      .eq("kategoria_id", CATEGORY_IDS.BLERESI_SHITESI)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data, error }) => {
        if (error) console.error(error);
        setBleresit(data || []);
      });
  }, []);

  // Load products dependent on selected category
  useEffect(() => {
    if (!filters.kategoria_id) {
      setProdukte([]);
      // reset product filter if category is cleared
      setFilters(prev => ({ ...prev, produkti_id: "" }));
      return;
    }

    supabase
      .from("kategoria_list")
      .select("id,name")
      .eq("kategoria_id", filters.kategoria_id)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data, error }) => {
        if (error) console.error(error);
        setProdukte(data || []);
      });
  }, [filters.kategoria_id]);

  /* ================= LOAD DATA WITH FILTERS ================= */

  const load = useCallback(async () => {
    let query = supabase
      .from("ditor")
      .select(
        `
        id,
        data,
        veprimi,
        sasia,
        shuma_leke,
        kosto_per_njesi,
        kategoria:kategoria_id(id,name),
        produkti:produkti_id(id,name),
        monedha:monedha_id(id,name),
        bleresi:bleresi_shitesi_id(id,name)
      `
      )
      .order("created_at", { ascending: false });

    if (filters.fromDate) query = query.gte("data", filters.fromDate);
    if (filters.toDate) query = query.lte("data", filters.toDate);

    if (filters.kategoria_id) query = query.eq("kategoria_id", filters.kategoria_id);
    if (filters.produkti_id) query = query.eq("produkti_id", filters.produkti_id);

    if (filters.monedha_id) query = query.eq("monedha_id", filters.monedha_id);
    if (filters.bleresi_id) query = query.eq("bleresi_shitesi_id", filters.bleresi_id);

    if (filters.veprimi) query = query.eq("veprimi", filters.veprimi);

    const { data, error } = await query;

    if (error) {
      console.error(error);
      return;
    }

    setRows(data || []);
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  /* ================= DELETE ================= */

  async function remove(id) {
    if (!window.confirm("Delete this record?")) return;

    const { error } = await supabase.from("ditor").delete().eq("id", id);
    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }
    load();
  }

  /* ================= FILTER HELPERS ================= */

  function setFilterField(name, value) {
    setFilters(prev => {
      // if category changes, reset product filter
      if (name === "kategoria_id") {
        return { ...prev, kategoria_id: value, produkti_id: "" };
      }
      return { ...prev, [name]: value };
    });
  }

  function resetFilters() {
    setFilters({
      fromDate: "",
      toDate: "",
      kategoria_id: "",
      produkti_id: "",
      monedha_id: "",
      bleresi_id: "",
      veprimi: ""
    });
  }

  /* ================= UI ================= */

  return (
    <div className="table-card">
      <div className="table-header">
        <h3>Filtra</h3>
      </div>

      <table className="data-table">
        <thead>
          {/* FILTER BAR */}
          <tr className="filter-bar">
            <th colSpan="10">
              <div className="filters-grid">
                <div>
                  <label>Nga</label>
                  <input
                    type="date"
                    value={filters.fromDate}
                    onChange={e => setFilterField("fromDate", e.target.value)}
                  />
                </div>

                <div>
                  <label>Në</label>
                  <input
                    type="date"
                    value={filters.toDate}
                    onChange={e => setFilterField("toDate", e.target.value)}
                  />
                </div>

                <div>
                  <label>Kategoria</label>
                  <select
                    value={filters.kategoria_id}
                    onChange={e => setFilterField("kategoria_id", e.target.value)}
                  >
                    <option value="">All</option>
                    {kategorite.map(k => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Produkti</label>
                  <select
                    value={filters.produkti_id}
                    disabled={!filters.kategoria_id || !produkte.length}
                    onChange={e => setFilterField("produkti_id", e.target.value)}
                  >
                    <option value="">All</option>
                    {produkte.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Monedha</label>
                  <select
                    value={filters.monedha_id}
                    onChange={e => setFilterField("monedha_id", e.target.value)}
                  >
                    <option value="">All</option>
                    {monedha.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Bleresi/Shitesi</label>
                  <select
                    value={filters.bleresi_id}
                    onChange={e => setFilterField("bleresi_id", e.target.value)}
                  >
                    <option value="">All</option>
                    {bleresit.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Veprimi</label>
                  <select
                    value={filters.veprimi}
                    onChange={e => setFilterField("veprimi", e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="Hyrje/Blerje">Hyrje/Blerje</option>
                    <option value="Shitje/Dalje">Shitje/Dalje</option>
                  </select>
                </div>

                <div className="reset-box">
                  <button className="reset-btn" onClick={resetFilters}>
                    Reset
                  </button>
                </div>
              </div>
            </th>
          </tr>

          {/* COLUMN HEADERS */}
          <tr>
            <th>Data</th>
            <th>Kategoria</th>
            <th>Produkti</th>
            <th>Monedha</th>
            <th>Bleresi/Shitesi</th>
            <th>Veprimi</th>
            <th>Sasia</th>
            <th>Shuma (ALL)</th>
            <th>Kosto/Njesi</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan="10" style={{ textAlign: "center", padding: 20 }}>
                No records found
              </td>
            </tr>
          )}

          {rows.map(r => (
            <tr key={r.id}>
              <td>{r.data}</td>
              <td>{r.kategoria?.name}</td>
              <td>{r.produkti?.name}</td>
              <td>{r.monedha?.name}</td>
              <td>{r.bleresi?.name}</td>
              <td>{r.veprimi}</td>
              <td>{r.sasia}</td>
              <td>{r.shuma_leke}</td>
              <td>{typeof r.kosto_per_njesi === "number" ? r.kosto_per_njesi.toFixed(2) : ""}</td>
              <td className="actions">
                <button onClick={() => setEditRow(r)}>✏️</button>
                <button onClick={() => remove(r.id)}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editRow && (
        <Modal title="Edit Entry" onClose={() => setEditRow(null)}>
          <DitorForm
            mode="edit"
            initialData={{
              id: editRow.id,
              data: editRow.data,
              kategoria_id: editRow.kategoria?.id || "",
              produkti_id: editRow.produkti?.id || "",
              monedha_id: editRow.monedha?.id || "",
              bleresi_shitesi_id: editRow.bleresi?.id || "",
              veprimi: editRow.veprimi,
              sasia: editRow.sasia,
              shuma_leke: editRow.shuma_leke
            }}
            onSaved={() => {
              setEditRow(null);
              load();
            }}
            onCancel={() => setEditRow(null)}
          />
        </Modal>
      )}
    </div>
  );
}
