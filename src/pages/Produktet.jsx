import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchFilterOptions, withFilter } from "../lib/ditorEntries";
import { fetchProducts, productTotals, productsWithoutMovement, sortProducts } from "../lib/produktet";
import { formatMoney, withKg, withLeke } from "../lib/format";
import useFetched from "../lib/useFetched";
import DatePicker from "../components/DatePicker";
import SearchSelect from "../components/SearchSelect";
import { RefreshBar, SkeletonRows } from "../components/Loading";
import "../components/DitorTable.css";
import "./Dashboard.css";
import "./Produktet.css";

// The columns, left to right: the key of the value in each row, its header, and how it sits and
// sorts. Text sorts A to Z first and numbers largest first; a second click reverses it.
const COLUMNS = [
  { key: "produkti", label: "Produkti", type: "text" },
  { key: "kategoria", label: "Kategoria", type: "text" },
  { key: "hyrjeKg", label: "Hyrje (kg)", type: "num" },
  { key: "daljeKg", label: "Dalje (kg)", type: "num" },
  { key: "stockKg", label: "Në magazinë (kg)", type: "num" },
  { key: "kostoHyrje", label: "Kosto/kg hyrje", type: "num" },
  { key: "kostoDalje", label: "Kosto/kg dalje", type: "num" },
  { key: "hyrjeShuma", label: "Shuma hyrje (lekë)", type: "num" },
  { key: "daljeShuma", label: "Shuma dalje (lekë)", type: "num" },
  { key: "totali", label: "Totali (lekë)", type: "num" }
];

// The placeholder for the first load: a row of text and numbers, as tall as a real one.
const SKELETON_COLUMNS = COLUMNS.map(column => column.type);
const ROW_HEIGHT = 41;

// Tjetër entries are money movements: their quantity of 1 isn't kilograms, so they have no kg and no cost per kg.
const TJETER_HINT = "Tjetër: lëvizje parash, pa sasi në kg dhe pa kosto për kg";
const FOOTER_HINT = "Nuk llogaritet nga produkte të ndryshme";

const NO_FILTERS = { fromDate: "", toDate: "", kategoria_id: "", produkti_id: "", monedha_id: "", bleresi_id: "" };

// The Diferenca style: a "+" before gains, next to the "-" that losses already have.
const plus = value => (value > 0 ? "+" : "");
const profitClass = value => (value < 0 ? " neg" : value > 0 ? " pos" : "");

export default function Produktet() {
  const [filters, setFilters] = useState(NO_FILTERS);
  const [includeEmpty, setIncludeEmpty] = useState(false);
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [options, setOptions] = useState({ kategorite: [], produkte: [], monedha: [], bleresit: [] });
  // The filter dropdowns show placeholders until their options arrive.
  const [lookupsLoading, setLookupsLoading] = useState(true);

  useEffect(() => {
    fetchFilterOptions()
      .then(setOptions)
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

  const rows = useMemo(() => {
    const found = products.data ?? [];
    const idle = includeEmpty ? productsWithoutMovement(found, options.produkte, options.kategorite, filters) : [];
    return sortProducts([...found, ...idle], sort);
  }, [products.data, includeEmpty, options, filters, sort]);
  const totals = useMemo(() => productTotals(rows), [rows]);

  function setF(name, value) {
    setFilters(prev => withFilter(prev, name, value, options.produkte));
  }

  function resetFilters() {
    setFilters(NO_FILTERS);
    setIncludeEmpty(false);
  }

  function sortBy(column) {
    setSort(prev =>
      prev.key === column.key
        ? { key: column.key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key: column.key, dir: column.type === "text" ? "asc" : "desc" }
    );
  }

  const cell = (row, value, show) => (row.tjeter ? "—" : show(value));
  const tjeterHint = row => (row.tjeter ? TJETER_HINT : undefined);

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

                <div>
                  <label className="pdCheck" title="Shfaq edhe produktet pa asnjë lëvizje me këto filtra">
                    <input type="checkbox" checked={includeEmpty} onChange={event => setIncludeEmpty(event.target.checked)} />
                    Edhe pa lëvizje
                  </label>
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
                      <td title={row.kategoria}>{row.kategoria}</td>
                      <td className="num" title={tjeterHint(row)}>{cell(row, row.hyrjeKg, withKg)}</td>
                      <td className="num" title={tjeterHint(row)}>{cell(row, row.daljeKg, withKg)}</td>
                      <td className={`num${row.tjeter ? "" : row.stockKg < 0 ? " neg" : ""}`} title={tjeterHint(row)}>
                        {cell(row, row.stockKg, value => plus(value) + withKg(value))}
                      </td>
                      <td className="num" title={tjeterHint(row)}>
                        {row.kostoHyrje == null ? "—" : formatMoney(row.kostoHyrje)}
                      </td>
                      <td className="num" title={tjeterHint(row)}>
                        {row.kostoDalje == null ? "—" : formatMoney(row.kostoDalje)}
                      </td>
                      <td className="num">{formatMoney(row.hyrjeShuma)}</td>
                      <td className="num">{formatMoney(row.daljeShuma)}</td>
                      <td className={`num${profitClass(row.totali)}`}>{plus(row.totali) + formatMoney(row.totali)}</td>
                    </tr>
                  ))}
                </tbody>

                {!loading && !loadError && rows.length > 0 && (
                  <tfoot className={`dtTotals${refreshing ? " is-stale" : ""}`}>
                    <tr>
                      <td colSpan={2}>
                        Totali ({totals.count.toLocaleString("en-US")} {totals.count === 1 ? "produkt" : "produkte"})
                      </td>
                      <td className="num">{withKg(totals.hyrjeKg)}</td>
                      <td className="num">{withKg(totals.daljeKg)}</td>
                      <td className="num" title={FOOTER_HINT}>—</td>
                      <td className="num" title={FOOTER_HINT}>—</td>
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
