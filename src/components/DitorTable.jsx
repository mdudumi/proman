import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { CATEGORY_IDS, NOT_ENTRY_CATEGORY_IDS } from "../lib/categoryIds";
import { entriesQuery, fetchAllEntries, isTjeterEntry } from "../lib/ditorEntries";
import { PDF_ROW_LIMIT, exportEntriesExcel, exportEntriesPdf } from "../lib/entriesExport";
import Modal from "./Modal";
import DitorForm from "./DitorForm";
import SearchSelect from "./SearchSelect";
import DatePicker from "./DatePicker";
import ClearableSelect from "./ClearableSelect";
import DitorTotals from "./DitorTotals";
import { RefreshBar, Skeleton, SkeletonRows, Spinner } from "./Loading";
import "./DitorTable.css";

const PAGE_SIZE = 100;

// The placeholder for the first load: Data … Kosto/Njesi, then the edit and delete buttons' column.
// A real row is 51px high, because of those buttons.
const SKELETON_COLUMNS = ["date", "text", "text", "text", "text", "text", "num", "num", "num", ""];
const ROW_HEIGHT = 51;

// Tjetër entries are money movements: their quantity of 1 isn't kilograms, so they have no kg and no unit cost.
const TJETER_HINT = "Tjetër: lëvizje parash, pa sasi në kg dhe pa kosto për njësi";

export default function DitorTable({ refreshKey = 0 }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  // False until the first answer arrives: until then there's nothing to show, so placeholders stand in.
  const [hasLoaded, setHasLoaded] = useState(false);
  // Numbers each request, so a slow answer to an older one can't replace a newer one's rows.
  const lastRequest = useRef(0);
  const [editRow, setEditRow] = useState(null);
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [exporting, setExporting] = useState("");
  const [pdfPrompt, setPdfPrompt] = useState(false);
  // Counts edits and deletes, so the totals rows reload after each one.
  const [changes, setChanges] = useState(0);

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

  // Either filter can be picked first: a category narrows the product list, a product fills in its category.
  useEffect(() => {
    supabase
      .from("kategoria_list")
      .select("id,name,kategoria_id")
      .eq("is_active", true)
      .not("kategoria_id", "in", `(${NOT_ENTRY_CATEGORY_IDS.join(",")})`)
      .order("name")
      .then(({ data }) => setProdukte(data || []));
  }, []);

  const kategoriaProdukte = filters.kategoria_id
    ? produkte.filter(p => String(p.kategoria_id) === String(filters.kategoria_id))
    : produkte;

  const load = useCallback(async () => {
    const request = ++lastRequest.current;
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    setLoading(true);
    const { data, error, count } = await entriesQuery(filters, { count: "exact" }).range(from, to);
    if (request !== lastRequest.current) return;

    setLoading(false);
    setHasLoaded(true);

    if (error) {
      console.error(error);
      setError(error.message);
      return;
    }

    setError("");
    setRows(data || []);
    setTotalRows(count || 0);
  }, [filters, page]);

  // refreshKey changes after an entry is added, so the new entry shows up.
  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function remove(id) {
    if (!window.confirm("Delete this record?")) return;

    const { error } = await supabase.from("ditor").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }

    setChanges(n => n + 1);
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
    setFilters(prev => {
      if (name === "produkti_id") {
        const produkti = produkte.find(p => String(p.id) === String(value));
        return { ...prev, produkti_id: value, kategoria_id: produkti?.kategoria_id ?? prev.kategoria_id };
      }
      if (name === "kategoria_id") {
        // Keep the product only if it belongs to the new category.
        const produkti = produkte.find(p => String(p.id) === String(prev.produkti_id));
        const keepProdukti = produkti && String(produkti.kategoria_id) === String(value);
        return { ...prev, kategoria_id: value, produkti_id: keepProdukti ? prev.produkti_id : "" };
      }
      return { ...prev, [name]: value };
    });
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

  // The active filters in words, printed at the top of the exports.
  function describeFilters() {
    const name = (list, id) => list.find(item => String(item.id) === String(id))?.name || "";
    const parts = [
      filters.kategoria_id && `Kategoria: ${name(kategorite, filters.kategoria_id)}`,
      filters.produkti_id && `Produkti: ${name(produkte, filters.produkti_id)}`,
      filters.monedha_id && `Monedha: ${name(monedha, filters.monedha_id)}`,
      filters.bleresi_id && `Blerësi/Shitësi: ${name(bleresit, filters.bleresi_id)}`,
      filters.veprimi && `Veprimi: ${filters.veprimi}`
    ].filter(Boolean);
    return `Filtrat: ${parts.length ? parts.join(" | ") : "asnjë, të gjitha regjistrimet"}`;
  }

  // Exports fetch every matching entry, not only the page on screen.
  async function runExport(kind) {
    setPdfPrompt(false);
    setExporting(kind);
    try {
      const entries = await fetchAllEntries(filters);
      const meta = {
        period: `${filters.fromDate ? formatDate(filters.fromDate) : "Fillimi"} – ${filters.toDate ? formatDate(filters.toDate) : "Sot"}`,
        filtersText: describeFilters(),
        filters,
        fileBase: `te-dhenat_${filters.fromDate || "fillimi"}_${filters.toDate || "sot"}`
      };
      if (kind === "excel") await exportEntriesExcel(entries, meta);
      else exportEntriesPdf(entries, meta);
    } catch (err) {
      console.error(err);
      alert(`Eksporti nuk u krye: ${err.message || err}`);
    } finally {
      setExporting("");
    }
  }

  // Over the PDF limit, ask first: the PDF prints only the latest rows.
  function exportPdf() {
    if (totalRows > PDF_ROW_LIMIT) setPdfPrompt(true);
    else runExport("pdf");
  }

  // The totals rows show only while at least one filter is set.
  const hasFilters = Object.values(filters).some(Boolean);

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
            <DatePicker
              value={filters.fromDate}
              onChange={value => setF("fromDate", value)}
              clearable
            />
          </div>

          <div>
            <label>Në</label>
            <DatePicker
              value={filters.toDate}
              onChange={value => setF("toDate", value)}
              clearable
            />
          </div>

          <div>
            <label>Kategoria</label>
            <SearchSelect
              value={filters.kategoria_id}
              onChange={value => setF("kategoria_id", value)}
              options={kategorite}
              placeholder="All"
            />
          </div>

          <div>
            <label>Produkti</label>
            <SearchSelect
              value={filters.produkti_id}
              disabled={!kategoriaProdukte.length}
              onChange={value => setF("produkti_id", value)}
              options={kategoriaProdukte}
              placeholder="All"
            />
          </div>

          <div>
            <label>Monedha</label>
            <SearchSelect
              value={filters.monedha_id}
              onChange={value => setF("monedha_id", value)}
              options={monedha}
              placeholder="All"
            />
          </div>

          <div>
            <label>Bleresi/Shitesi</label>
            <SearchSelect
              value={filters.bleresi_id}
              onChange={value => setF("bleresi_id", value)}
              options={bleresit}
              placeholder="All"
            />
          </div>

          <div>
            <label>Veprimi</label>
            <ClearableSelect
              value={filters.veprimi}
              onChange={value => setF("veprimi", value)}
            >
              <option value="">All</option>
              <option value="Hyrje/Blerje">Hyrje/Blerje</option>
              <option value="Shitje/Dalje">Shitje/Dalje</option>
            </ClearableSelect>
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
          {hasLoaded ? (
            <>Duke shfaqur <strong>{startRow}</strong> - <strong>{endRow}</strong> nga <strong>{totalRows}</strong> rekorde</>
          ) : (
            <Skeleton width={210} height={14} />
          )}
        </div>

        <div className="dtExportActions">
          <button className="dtExportBtn" onClick={() => runExport("excel")} disabled={!totalRows || Boolean(exporting)}>
            {exporting === "excel" ? <><Spinner />Duke përgatitur…</> : "Eksporto Excel"}
          </button>
          <button className="dtExportBtn" onClick={exportPdf} disabled={!totalRows || Boolean(exporting)}>
            {exporting === "pdf" ? <><Spinner />Duke përgatitur…</> : "Eksporto PDF"}
          </button>
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

      <RefreshBar active={loading && hasLoaded} />
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

          <tbody className={loading && hasLoaded ? "is-refreshing" : undefined} aria-busy={loading}>
            {!hasLoaded && <SkeletonRows rows={10} columns={SKELETON_COLUMNS} rowHeight={ROW_HEIGHT} />}

            {error && (
              <tr>
                <td colSpan="10" className="dtEmpty dtError">
                  Të dhënat nuk u ngarkuan: {error}
                  <button className="dtRetryBtn" onClick={load}>
                    Provo përsëri
                  </button>
                </td>
              </tr>
            )}

            {hasLoaded && !error && rows.length === 0 && (
              <tr>
                <td colSpan="10" className="dtEmpty">
                  No records found
                </td>
              </tr>
            )}

            {!error && rows.map(r => (
              <tr key={r.id}>
                <td title={r.data}>{formatDate(r.data)}</td>
                <td title={r.kategoria?.name || ""}>{r.kategoria?.name}</td>
                <td title={r.produkti?.name || ""}>{r.produkti?.name}</td>
                <td title={r.monedha?.name || ""}>{r.monedha?.name}</td>
                <td title={r.bleresi?.name || ""}>{r.bleresi?.name}</td>
                <td title={r.veprimi || ""}>{r.veprimi}</td>
                <td className="num" title={isTjeterEntry(r) ? TJETER_HINT : undefined}>
                  {isTjeterEntry(r) ? "—" : r.sasia}
                </td>
                <td className="num">{r.shuma_leke}</td>
                <td className="num" title={isTjeterEntry(r) ? TJETER_HINT : undefined}>
                  {isTjeterEntry(r)
                    ? "—"
                    : typeof r.kosto_per_njesi === "number"
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

          {hasFilters && !error && totalRows > 0 && (
            <DitorTotals filters={filters} reloadKey={`${refreshKey}.${changes}`} />
          )}
        </table>
      </div>

      {pdfPrompt && (
        <Modal title="Eksporti në PDF" onClose={() => setPdfPrompt(false)} className="modal--small">
          <p className="dtDialogText">
            Ky PDF do të përfshijë <strong>{PDF_ROW_LIMIT.toLocaleString("en-US")}</strong> regjistrimet më të fundit
            nga <strong>{totalRows.toLocaleString("en-US")}</strong> që përputhen me filtrat. Totalet në fund do të
            llogariten për të gjitha regjistrimet.
          </p>
          <p className="dtDialogText">
            Për të gjitha regjistrimet, ngushtoni datat ose eksportoni në Excel.
          </p>
          <div className="dtDialogActions">
            <button className="dtExportBtn" onClick={() => setPdfPrompt(false)}>Anulo</button>
            <button className="dtExportBtn" onClick={() => runExport("excel")}>Eksporto në Excel</button>
            <button className="dtExportBtn dtExportBtn--primary" onClick={() => runExport("pdf")}>Shkarko PDF</button>
          </div>
        </Modal>
      )}

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
              setChanges(n => n + 1);
              load();
            }}
            onCancel={() => setEditRow(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}
