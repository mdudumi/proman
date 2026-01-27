import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
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

  useEffect(() => {
    supabase.from("kategoria").select("id,name").order("name")
      .then(({ data }) => setKategorite(data || []));

    supabase.from("kategoria_list").select("id,name").order("name")
      .then(({ data }) => setProdukte(data || []));

    supabase.from("kategoria_list").select("id,name").order("name")
      .then(({ data }) => setMonedha(data || []));

    supabase.from("kategoria_list").select("id,name").order("name")
      .then(({ data }) => setBleresit(data || []));
  }, []);

  /* ================= LOAD DATA WITH FILTERS ================= */

  async function load() {
    let query = supabase
      .from("ditor")
      .select(`
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
      `)
      .order("created_at", { ascending: false });

    if (filters.fromDate)
      query = query.gte("data", filters.fromDate);

    if (filters.toDate)
      query = query.lte("data", filters.toDate);

    if (filters.kategoria_id)
      query = query.eq("kategoria_id", filters.kategoria_id);

    if (filters.produkti_id)
      query = query.eq("produkti_id", filters.produkti_id);

    if (filters.monedha_id)
      query = query.eq("monedha_id", filters.monedha_id);

    if (filters.bleresi_id)
      query = query.eq("bleresi_shitesi_id", filters.bleresi_id);

    if (filters.veprimi)
      query = query.eq("veprimi", filters.veprimi);

    const { data, error } = await query;

    if (error) {
      console.error(error);
      return;
    }

    setRows(data || []);
  }

  useEffect(() => {
    load();
  }, [filters]);

  /* ================= DELETE ================= */

  async function remove(id) {
    if (!window.confirm("Delete this record?")) return;

    await supabase.from("ditor").delete().eq("id", id);
    load();
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
            onChange={e =>
              setFilters({ ...filters, fromDate: e.target.value })
            }
          />
        </div>

        <div>
          <label>Në</label>
          <input
            type="date"
            value={filters.toDate}
            onChange={e =>
              setFilters({ ...filters, toDate: e.target.value })
            }
          />
        </div>

        <div>
          <label>Kategoria</label>
          <select
            value={filters.kategoria_id}
            onChange={e =>
              setFilters({ ...filters, kategoria_id: e.target.value })
            }
          >
            <option value="">All</option>
            {kategorite.map(k => (
              <option key={k.id} value={k.id}>{k.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Produkti</label>
          <select
            value={filters.produkti_id}
            onChange={e =>
              setFilters({ ...filters, produkti_id: e.target.value })
            }
          >
            <option value="">All</option>
            {produkte.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Monedha</label>
          <select
            value={filters.monedha_id}
            onChange={e =>
              setFilters({ ...filters, monedha_id: e.target.value })
            }
          >
            <option value="">All</option>
            {monedha.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Bleresi/Shitesi</label>
          <select
            value={filters.bleresi_id}
            onChange={e =>
              setFilters({ ...filters, bleresi_id: e.target.value })
            }
          >
            <option value="">All</option>
            {bleresit.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Veprimi</label>
          <select
            value={filters.veprimi}
            onChange={e =>
              setFilters({ ...filters, veprimi: e.target.value })
            }
          >
            <option value="">All</option>
            <option value="Hyrje/Blerje">Hyrje/Blerje</option>
            <option value="Shitje/Dalje">Shitje/Dalje</option>
          </select>
        </div>

        <div className="reset-box">
          <button
            className="reset-btn"
            onClick={() =>
              setFilters({
                fromDate: "",
                toDate: "",
                kategoria_id: "",
                produkti_id: "",
                monedha_id: "",
                bleresi_id: "",
                veprimi: ""
              })
            }
          >
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
              <td>{r.kosto_per_njesi?.toFixed(2)}</td>
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
              kategoria_id: editRow.kategoria?.id,
              produkti_id: editRow.produkti?.id,
              monedha_id: editRow.monedha?.id,
              bleresi_shitesi_id: editRow.bleresi?.id,
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
