import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { CATEGORY_IDS } from "../lib/categoryIds";
import Modal from "./Modal";
import DitorForm from "./DitorForm";
import "./DitorTable.css";

const PAGE_SIZE = 100;

export default function DitorTable() {
  const [rows, setRows] = useState([]);
  const [editRow, setEditRow] = useState(null);
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);

  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
    kategoria_id: "",
    produkti_id: "",
    monedha_id: "",
    bleresi_id: "",
    veprimi: ""
  });

  const [kategorite, setKategorite] = useState([]);
  const [produkte, setProdukte] = useState([]);
  const [monedha, setMonedha] = useState([]);
  const [bleresit, setBleresit] = useState([]);

  useEffect(() => {
    supabase
      .from("kategoria")
      .select("id,name")
      .order("name")
      .then(({ data }) => setKategorite(data || []));
  }, []);

  useEffect(() => {
    supabase
      .from("kategoria_list")
      .select("id,name")
      .eq("kategoria_id", CATEGORY_IDS.MONEDHA)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setMonedha(data || []));

    supabase
      .from("kategoria_list")
      .select("id,name")
      .eq("kategoria_id", CATEGORY_IDS.BLERESI_SHITESI)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setBleresit(data || []));
  }, []);

  useEffect(() => {
    if (!filters.kategoria_id) {
      setProdukte([]);
      setFilters(prev => ({ ...prev, produkti_id: "" }));
      return;
    }

    supabase
      .from("kategoria_list")
      .select("id,name")
      .eq("kategoria_id", filters.kategoria_id)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setProdukte(data || []));
  }, [filters.kategoria_id]);

  const load = useCallback(async () => {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let q = supabase
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
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (filters.fromDate) q = q.gte("data", filters.fromDate);
    if (filters.toDate) q = q.lte("data", filters.toDate);
    if (filters.kategoria_id) q = q.eq("kategoria_id", filters.kategoria_id);
    if (filters.produkti_id) q = q.eq("produkti_id", filters.produkti_id);
    if (filters.monedha_id) q = q.eq("monedha_id", filters.monedha_id);
    if (filters.bleresi_id) q = q.eq("bleresi_shitesi_id", filters.bleresi_id);
    if (filters.veprimi) q = q.eq("veprimi", filters.veprimi);

    const { data, error, count } = await q.range(from, to);

    if (error) {
      console.error(error);
      return;
    }

    setRows(data || []);
    setTotalRows(count || 0);
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id) {
    if (!window.confirm("Delete this record?")) return;

    const { error } = await supabase.from("ditor").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }

    const newTotal = Math.max(totalRows - 1, 0);
    const maxPage = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));

    if (page > maxPage) {
      setPage(maxPage);
    } else {
      load();
    }
  }

  function setF(name, value) {
    setPage(1);
    setFilters(prev =>
      name === "kategoria_id"
        ? { ...prev, kategoria_id: value, produkti_id: "" }
        : { ...prev, [name]: value }
    );
  }

  function resetFilters() {
    setPage(1);
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

  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const startRow = totalRows === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endRow = Math.min(page * PAGE_SIZE, totalRows);

  return (
    <div className="dtWrap">
      <div className="dtFilters">
        <div className="dtFiltersTitle">Filtra</div>

        <div className="dtFiltersGrid">
          <div>
            <label>Nga</label>
            <input
              type="date"
              value={filters.fromDate}
              onChange={e => setF("fromDate", e.target.value)}
            />
          </div>

          <div>
            <label>Në</label>
            <input
              type="date"
              value={filters.toDate}
              onChange={e => setF("toDate", e.target.value)}
            />
          </div>

          <div>
            <label>Kategoria</label>
            <select
              value={filters.kategoria_id}
              onChange={e => setF("kategoria_id", e.target.value)}
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
              onChange={e => setF("produkti_id", e.target.value)}
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
              onChange={e => setF("monedha_id", e.target.value)}
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
              onChange={e => setF("bleresi_id", e.target.value)}
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
              onChange={e => setF("veprimi", e.target.value)}
            >
              <option value="">All</option>
              <option value="Hyrje/Blerje">Hyrje/Blerje</option>
              <option value="Shitje/Dalje">Shitje/Dalje</option>
            </select>
          </div>

          <div className="dtResetBox">
            <button className="dtResetBtn" onClick={resetFilters}>
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="dtPager">
        <div className="dtPagerInfo">
          Duke shfaqur <strong>{startRow}</strong> - <strong>{endRow}</strong> nga <strong>{totalRows}</strong> rekorde
        </div>

        <div className="dtPagerActions">
          <button
            className="dtPagerBtn"
            onClick={() => setPage(1)}
            disabled={page === 1}
          >
            «
          </button>

          <button
            className="dtPagerBtn"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ‹
          </button>

          <span className="dtPagerText">
            Faqja {page} / {totalPages}
          </span>

          <button
            className="dtPagerBtn"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            ›
          </button>

          <button
            className="dtPagerBtn"
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages}
          >
            »
          </button>
        </div>
      </div>

      <div className="dtScroll">
        <table className="dtTable">
          <thead>
            <tr>
              <th>Data</th>
              <th>Kategoria</th>
              <th>Produkti</th>
              <th>Monedha</th>
              <th>Bleresi/Shitesi</th>
              <th>Veprimi</th>
              <th>Sasia</th>
              <th>Shuma</th>
              <th>Kosto/Njesi</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan="10" className="dtEmpty">
                  No records found
                </td>
              </tr>
            )}

            {rows.map(r => (
              <tr key={r.id}>
                <td title={r.data}>{r.data}</td>
                <td title={r.kategoria?.name || ""}>{r.kategoria?.name}</td>
                <td title={r.produkti?.name || ""}>{r.produkti?.name}</td>
                <td title={r.monedha?.name || ""}>{r.monedha?.name}</td>
                <td title={r.bleresi?.name || ""}>{r.bleresi?.name}</td>
                <td title={r.veprimi || ""}>{r.veprimi}</td>
                <td className="num">{r.sasia}</td>
                <td className="num">{r.shuma_leke}</td>
                <td className="num">
                  {typeof r.kosto_per_njesi === "number"
                    ? r.kosto_per_njesi.toFixed(2)
                    : ""}
                </td>
                <td className="actions">
                  <button onClick={() => setEditRow(r)}>✏️</button>
                  <button onClick={() => remove(r.id)}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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