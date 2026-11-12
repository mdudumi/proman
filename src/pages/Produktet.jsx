import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CATEGORY_IDS } from "../lib/categoryIds";
import { fetchFilterOptions, withFilter } from "../lib/ditorEntries";
import { fetchProducts, productTotals, sortProducts } from "../lib/produktet";
import { formatMoney, withKg, withLeke } from "../lib/format";
import useFetched from "../lib/useFetched";
import DatePicker from "../components/DatePicker";
import SearchSelect from "../components/SearchSelect";
import { RefreshBar, SkeletonRows } from "../components/Loading";
import "../components/DitorTable.css";
import "./Dashboard.css";
import "./Produktet.css";

// The columns, left to right: the key of the value in each row, its header, and how it sits.
// Clicking a header sorts by it: A to Z (or smallest first), then Z to A, then back to the
// original order of the rows.
const COLUMNS = [
  { key: "produkti", label: "Produkti", type: "text" },
  { key: "hyrjeKg", label: "Hyrje (kg)", type: "num" },
  { key: "daljeKg", label: "Dalje (kg)", type: "num" },
  { key: "stockKg", label: "Në magazinë (kg)", type: "num" },
  { key: "kostoHyrje", label: "Kosto/kg hyrje", type: "num" },
  { key: "stockValue", label: "Vlera në magazinë (lekë)", type: "num" },
  { key: "kostoDalje", label: "Kosto/kg dalje", type: "num" },
  { key: "hyrjeShuma", label: "Shuma hyrje (lekë)", type: "num" },
  { key: "daljeShuma", label: "Shuma dalje (lekë)", type: "num" },
  { key: "totali", label: "Totali (lekë)", type: "num" }
];

// The placeholder for the first load: a row of text and numbers, as tall as a real one.
const SKELETON_COLUMNS = COLUMNS.map(column => column.type);
const ROW_HEIGHT = 41;

const NO_PURCHASE_HINT = "Pa blerje, nuk ka çmim blerjeje për ta vlerësuar";
const FOOTER_HINT = "Nuk llogaritet nga produkte të ndryshme";

const NO_FILTERS = { fromDate: "", toDate: "", kategoria_id: "", produkti_id: "", monedha_id: "", bleresi_id: "" };

// Tjetër is money movements, not goods, so it isn't offered as a category or a product here.
const withoutTjeter = options => ({
  ...options,
  kategorite: options.kategorite.filter(k => k.id !== CATEGORY_IDS.TJETER),
  produkte: options.produkte.filter(p => p.kategoria_id !== CATEGORY_IDS.TJETER)
});

// The Diferenca style: a "+" before gains, next to the "-" that losses already have.
const plus = value => (value > 0 ? "+" : "");
const profitClass = value => (value < 0 ? " neg" : value > 0 ? " pos" : "");

export default function Produktet() {
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [options, setOptions] = useState({ kategorite: [], produkte: [], monedha: [], bleresit: [] });
  // The filter dropdowns show placeholders until their options arrive.
  const [lookupsLoading, setLookupsLoading] = useState(true);

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

  function setF(name, value) {
    setFilters(prev => withFilter(prev, name, value, options.produkte));
  }

  function resetFilters() {
    setFilters(NO_FILTERS);
  }

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

            <RefreshBar active={refreshing} />
            <div className="dtScroll">
              <table className="dtTable">
                <thead>
                  <tr>
                    {COLUMNS.map(column => (
                      <th
                        key={column.key}
                        className={column.type === "num" ? "num" : undefined}
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
                  {loading && <SkeletonRows rows={8} columns={SKELETON_COLUMNS} rowHeight={ROW_HEIGHT} />}

                  {loadError && (
                    <tr>
                      <td colSpan={COLUMNS.length} className="dtEmpty dtError">
                        Të dhënat nuk u ngarkuan: {loadError}
                        <button className="dtRetryBtn" onClick={products.retry}>
                          Provo përsëri
                        </button>
                      </td>
                    </tr>
                  )}

                  {!loading && !loadError && rows.length === 0 && (
                    <tr>
                      <td colSpan={COLUMNS.length} className="dtEmpty">
                        Nuk u gjet asnjë produkt
                      </td>
                    </tr>
                  )}

                  {!loading && !loadError && rows.map(row => (
                    <tr key={row.produktiId ?? "pa-produkt"}>
                      <td title={row.produkti}>{row.produkti}</td>
                      <td className="num">{withKg(row.hyrjeKg)}</td>
                      <td className="num">{withKg(row.daljeKg)}</td>
                      <td className={`num${row.stockKg < 0 ? " neg" : ""}`}>{plus(row.stockKg) + withKg(row.stockKg)}</td>
                      <td className="num">{row.kostoHyrje == null ? "—" : formatMoney(row.kostoHyrje)}</td>
                      <td
                        className={`num${row.stockValue < 0 ? " neg" : ""}`}
                        title={row.stockValue == null ? NO_PURCHASE_HINT : undefined}
                      >
                        {row.stockValue == null ? "—" : formatMoney(row.stockValue)}
                      </td>
                      <td className="num">{row.kostoDalje == null ? "—" : formatMoney(row.kostoDalje)}</td>
                      <td className="num">{formatMoney(row.hyrjeShuma)}</td>
                      <td className="num">{formatMoney(row.daljeShuma)}</td>
                      <td className={`num${profitClass(row.totali)}`}>{plus(row.totali) + formatMoney(row.totali)}</td>
                    </tr>
                  ))}
                </tbody>

                {!loading && !loadError && rows.length > 0 && (
                  <tfoot className={`dtTotals${refreshing ? " is-stale" : ""}`}>
                    <tr>
                      <td>
                        Totali ({totals.count.toLocaleString("en-US")} {totals.count === 1 ? "produkt" : "produkte"})
                      </td>
                      <td className="num">{withKg(totals.hyrjeKg)}</td>
                      <td className="num">{withKg(totals.daljeKg)}</td>
                      <td className={`num${totals.stockKg < 0 ? " neg" : ""}`}>{plus(totals.stockKg) + withKg(totals.stockKg)}</td>
                      <td className="num" title={FOOTER_HINT}>—</td>
                      <td className={`num${totals.stockValue < 0 ? " neg" : ""}`}>{withLeke(totals.stockValue)}</td>
                      <td className="num" title={FOOTER_HINT}>—</td>
                      <td className="num">{withLeke(totals.hyrjeShuma)}</td>
                      <td className="num">{withLeke(totals.daljeShuma)}</td>
                      <td className={`num${profitClass(totals.totali)}`}>{plus(totals.totali) + withLeke(totals.totali)}</td>
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
