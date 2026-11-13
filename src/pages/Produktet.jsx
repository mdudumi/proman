import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CATEGORY_IDS } from "../lib/categoryIds";
import { fetchFilterOptions, withFilter } from "../lib/ditorEntries";
import { PRODUCT_COLUMNS, fetchProducts, productTotals, sortProducts } from "../lib/produktet";
import { exportProductsExcel, exportProductsPdf } from "../lib/produktetExport";
import { formatMoney, withKg, withLeke } from "../lib/format";
import useFetched from "../lib/useFetched";
import DatePicker from "../components/DatePicker";
import SearchSelect from "../components/SearchSelect";
import { RefreshBar, Skeleton, SkeletonRows, Spinner } from "../components/Loading";
import "../components/DitorTable.css";
import "./Dashboard.css";
import "./Produktet.css";

// A real row is this tall, and the placeholder rows for the first load match it.
const ROW_HEIGHT = 41;

const NO_PURCHASE_HINT = "Pa blerje, nuk ka çmim blerjeje për ta vlerësuar";
const FOOTER_HINT = "Nuk llogaritet nga produkte të ndryshme";

// The two versions of the exports (produktetExport.js): everything in the table, or only the kg,
// with no prices and no lekë, to hand to others.
const EXPORT_GROUPS = [
  { shared: false, label: "Personale", hint: "Gjithçka që ka tabela", file: "personale" },
  { shared: true, label: "Për ndarje", hint: "Pa çmimet e blerjes e të shitjes dhe pa shumat në lekë", file: "per-ndarje" }
];

const NO_FILTERS = { fromDate: "", toDate: "", kategoria_id: "", produkti_id: "", monedha_id: "", bleresi_id: "" };

// Tjetër is money movements, not goods, so it isn't offered as a category or a product here.
const withoutTjeter = options => ({
  ...options,
  kategorite: options.kategorite.filter(k => k.id !== CATEGORY_IDS.TJETER),
  produkte: options.produkte.filter(p => p.kategoria_id !== CATEGORY_IDS.TJETER)
});

// The Diferenca style: a "+" before gains, next to the "-" that losses already have.
const plus = value => (value > 0 ? "+" : "");
const formatDate = value => {
  const [year, month, day] = String(value || "").split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
};
const tone = value => (value < 0 ? "neg" : value > 0 ? "pos" : "");

// What each column shows in a product's row: its text, a colour (`tone`) and a note (`title`).
const ROW_CELLS = {
  produkti: row => ({ content: row.produkti, title: row.produkti }),
  hyrjeKg: row => ({ content: withKg(row.hyrjeKg) }),
  daljeKg: row => ({ content: withKg(row.daljeKg) }),
  stockKg: row => ({ content: plus(row.stockKg) + withKg(row.stockKg), tone: row.stockKg < 0 ? "neg" : "" }),
  kostoHyrje: row => ({ content: row.kostoHyrje == null ? "—" : formatMoney(row.kostoHyrje) }),
  stockValue: row => ({
    content: row.stockValue == null ? "—" : formatMoney(row.stockValue),
    tone: row.stockValue < 0 ? "neg" : "",
    title: row.stockValue == null ? NO_PURCHASE_HINT : undefined
  }),
  kostoDalje: row => ({ content: row.kostoDalje == null ? "—" : formatMoney(row.kostoDalje) }),
  hyrjeShuma: row => ({ content: formatMoney(row.hyrjeShuma) }),
  daljeShuma: row => ({ content: formatMoney(row.daljeShuma) }),
  totali: row => ({ content: plus(row.totali) + formatMoney(row.totali), tone: tone(row.totali) })
};

// The same for the totals row under the table. Kosto/kg means nothing across different products.
const TOTAL_CELLS = {
  produkti: totals => ({
    content: `Totali (${totals.count.toLocaleString("en-US")} ${totals.count === 1 ? "produkt" : "produkte"})`
  }),
  hyrjeKg: totals => ({ content: withKg(totals.hyrjeKg) }),
  daljeKg: totals => ({ content: withKg(totals.daljeKg) }),
  stockKg: totals => ({ content: plus(totals.stockKg) + withKg(totals.stockKg), tone: totals.stockKg < 0 ? "neg" : "" }),
  kostoHyrje: () => ({ content: "—", title: FOOTER_HINT }),
  stockValue: totals => ({ content: withLeke(totals.stockValue), tone: totals.stockValue < 0 ? "neg" : "" }),
  kostoDalje: () => ({ content: "—", title: FOOTER_HINT }),
  hyrjeShuma: totals => ({ content: withLeke(totals.hyrjeShuma) }),
  daljeShuma: totals => ({ content: withLeke(totals.daljeShuma) }),
  totali: totals => ({ content: plus(totals.totali) + withLeke(totals.totali), tone: tone(totals.totali) })
};

// A cell of the column, with its content and colour from `cell`. Numbers sit on the right.
function Cell({ column, cell }) {
  const className = [column.format === "text" ? "" : "num", cell.tone].filter(Boolean).join(" ");
  return <td className={className || undefined} title={cell.title}>{cell.content}</td>;
}

export default function Produktet() {
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [options, setOptions] = useState({ kategorite: [], produkte: [], monedha: [], bleresit: [] });
  // The filter dropdowns show placeholders until their options arrive.
  const [lookupsLoading, setLookupsLoading] = useState(true);
  // Which export is being prepared, as "personale-excel", or "" when none is.
  const [exporting, setExporting] = useState("");
  // Shows the table as the version for sharing will be: only the kg, no prices and no lekë.
  const [sharedView, setSharedView] = useState(false);

  useEffect(() => {
    fetchFilterOptions()
      .then(options => setOptions(withoutTjeter(options)))
      .catch(err => console.error(err))
      .finally(() => setLookupsLoading(false));
  }, []);

  const kategoriaProdukte = filters.kategoria_id
    ? options.produkte.filter(p => String(p.kategoria_id) === String(filters.kategoria_id))
    : options.produkte;

  // The rows come added up by the database. Until the first answer there's nothing to show; after
  // that, what's on screen stays, dimmed, while a newer answer loads.
  const products = useFetched(fetchProducts, filters);
  const loadError = products.error && !products.stale ? products.error : "";
  const loading = !loadError && (!products.loaded || Boolean(products.error));
  const refreshing = !loading && !loadError && products.stale;

  const rows = useMemo(() => sortProducts(products.data ?? [], sort), [products.data, sort]);
  const totals = useMemo(() => productTotals(rows), [rows]);
  const columns = useMemo(() => PRODUCT_COLUMNS.filter(column => !sharedView || column.shared), [sharedView]);
  const canExport = !loading && !refreshing && !loadError && rows.length > 0 && !exporting;

  function setF(name, value) {
    setFilters(prev => withFilter(prev, name, value, options.produkte));
  }

  function resetFilters() {
    setFilters(NO_FILTERS);
  }

  // The active filters in words, printed at the top of the exports.
  function describeFilters() {
    const name = (list, id) => list.find(item => String(item.id) === String(id))?.name || "";
    const parts = [
      filters.kategoria_id && `Kategoria: ${name(options.kategorite, filters.kategoria_id)}`,
      filters.produkti_id && `Produkti: ${name(options.produkte, filters.produkti_id)}`,
      filters.monedha_id && `Monedha: ${name(options.monedha, filters.monedha_id)}`,
      filters.bleresi_id && `Blerësi/Shitësi: ${name(options.bleresit, filters.bleresi_id)}`
    ].filter(Boolean);
    return `Filtrat: ${parts.length ? parts.join(" | ") : "asnjë, të gjitha produktet"}`;
  }

  // The rows as they are on screen, in the personal or the shared version.
  async function runExport(kind, group) {
    setExporting(`${group.file}-${kind}`);
    try {
      const meta = {
        period: `${filters.fromDate ? formatDate(filters.fromDate) : "Fillimi"} – ${filters.toDate ? formatDate(filters.toDate) : "Sot"}`,
        filtersText: describeFilters(),
        shared: group.shared,
        fileBase: `produktet-${group.file}_${filters.fromDate || "fillimi"}_${filters.toDate || "sot"}`
      };
      if (kind === "excel") await exportProductsExcel(rows, totals, meta);
      else exportProductsPdf(rows, totals, meta);
    } catch (err) {
      console.error(err);
      alert(`Eksporti nuk u krye: ${err.message || err}`);
    } finally {
      setExporting("");
    }
  }

  function previewShared(checked) {
    setSharedView(checked);
    // Sorted by a column the shared version doesn't have, its order would have no header to explain it.
    const sorted = PRODUCT_COLUMNS.find(column => column.key === sort.key);
    if (checked && sorted && !sorted.shared) setSort({ key: null, dir: "asc" });
  }

  // Clicking a column header sorts by it: A to Z (or smallest first), then Z to A, then back to the
  // original order of the rows.
  function sortBy(column) {
    setSort(prev => {
      if (prev.key !== column.key) return { key: column.key, dir: "asc" };
      return prev.dir === "asc" ? { key: column.key, dir: "desc" } : { key: null, dir: "asc" };
    });
  }

  return (
    <div className="main main--single">
      <div className="right right--full">
        <div className="pageHead">
          <div className="rightTitle">Produktet</div>
          <Link to="/dashboard" className="app-btn">← Forma Hyrëse</Link>
        </div>

        <div className="rightBody">
          <div className="dtWrap">
            <div className="dtFilters">
              <div className="dtFiltersTitle">Filtra</div>

              <div className="dtFiltersGrid">
                <div>
                  <label>Nga</label>
                  <DatePicker value={filters.fromDate} onChange={value => setF("fromDate", value)} clearable />
                </div>

                <div>
                  <label>Në</label>
                  <DatePicker value={filters.toDate} onChange={value => setF("toDate", value)} clearable />
                </div>

                <div>
                  <label>Kategoria</label>
                  <SearchSelect
                    value={filters.kategoria_id}
                    onChange={value => setF("kategoria_id", value)}
                    options={options.kategorite}
                    placeholder="All"
                    loading={lookupsLoading}
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
                    loading={lookupsLoading}
                  />
                </div>

                <div>
                  <label>Monedha</label>
                  <SearchSelect
                    value={filters.monedha_id}
                    onChange={value => setF("monedha_id", value)}
                    options={options.monedha}
                    placeholder="All"
                    loading={lookupsLoading}
                  />
                </div>

                <div>
                  <label>Bleresi/Shitesi</label>
                  <SearchSelect
                    value={filters.bleresi_id}
                    onChange={value => setF("bleresi_id", value)}
                    options={options.bleresit}
                    placeholder="All"
                    loading={lookupsLoading}
                  />
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
                {loading ? (
                  <Skeleton width={90} height={14} />
                ) : (
                  <span><strong>{rows.length}</strong> {rows.length === 1 ? "produkt" : "produkte"}</span>
                )}
                <label className="pdPreview" title="Shfaq tabelën si do të dalë në versionin për ndarje: vetëm kg, pa çmime e pa shuma">
                  <input type="checkbox" checked={sharedView} onChange={event => previewShared(event.target.checked)} />
                  Pamje për ndarje
                </label>
              </div>

              <div className="pdExports">
                {EXPORT_GROUPS.map(group => (
                  <div className="pdExportGroup" role="group" aria-label={group.label} title={group.hint} key={group.file}>
                    <span className="pdExportLabel">{group.label}</span>
                    {[["excel", "Excel"], ["pdf", "PDF"]].map(([kind, name]) => (
                      <button
                        className="dtExportBtn"
                        key={kind}
                        onClick={() => runExport(kind, group)}
                        disabled={!canExport}
                      >
                        {exporting === `${group.file}-${kind}` ? <><Spinner />Duke përgatitur…</> : name}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <RefreshBar active={refreshing} />
            <div className="dtScroll">
              <table className={`dtTable${sharedView ? " pdShared" : ""}`}>
                <thead>
                  <tr>
                    {columns.map(column => (
                      <th
                        key={column.key}
                        className={column.format === "text" ? undefined : "num"}
                        aria-sort={sort.key === column.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                      >
                        <button className="pdSort" onClick={() => sortBy(column)}>
                          {column.label}
                          <span className="pdArrow" aria-hidden="true">
                            {sort.key === column.key ? (sort.dir === "asc" ? "▲" : "▼") : ""}
                          </span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className={refreshing ? "is-refreshing" : undefined} aria-busy={loading}>
                  {loading && (
                    <SkeletonRows
                      rows={8}
                      columns={columns.map(column => (column.format === "text" ? "text" : "num"))}
                      rowHeight={ROW_HEIGHT}
                    />
                  )}

                  {loadError && (
                    <tr>
                      <td colSpan={columns.length} className="dtEmpty dtError">
                        Të dhënat nuk u ngarkuan: {loadError}
                        <button className="dtRetryBtn" onClick={products.retry}>
                          Provo përsëri
                        </button>
                      </td>
                    </tr>
                  )}

                  {!loading && !loadError && rows.length === 0 && (
                    <tr>
                      <td colSpan={columns.length} className="dtEmpty">
                        Nuk u gjet asnjë produkt
                      </td>
                    </tr>
                  )}

                  {!loading && !loadError && rows.map(row => (
                    <tr key={row.produktiId ?? "pa-produkt"}>
                      {columns.map(column => (
                        <Cell key={column.key} column={column} cell={ROW_CELLS[column.key](row)} />
                      ))}
                    </tr>
                  ))}
                </tbody>

                {!loading && !loadError && rows.length > 0 && (
                  <tfoot className={`dtTotals${refreshing ? " is-stale" : ""}`}>
                    <tr>
                      {columns.map(column => (
                        <Cell key={column.key} column={column} cell={TOTAL_CELLS[column.key](totals)} />
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
