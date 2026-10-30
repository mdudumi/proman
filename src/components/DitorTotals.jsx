import { useEffect, useState } from "react";
import { entryTotals, fetchEntryTotals, selectionFilters, totalsLines } from "../lib/ditorEntries";
import { Skeleton } from "./Loading";

// The dashboard table's columns: the label spans the first six (Data … Veprimi),
// then Sasia, Shuma, Kosto/Njesi, and the column with the edit and delete buttons.
const LABEL_COLUMNS = 6;
const ALL_COLUMNS = 10;

const TJETER_HINT = "Pa regjistrimet Tjetër: ato janë lëvizje parash, jo kg";
// Across products the totals have no cost per kg, and the difference line no kg (totalsLines).
const FILTER_HINTS = {
  average: "Kosto për kg shfaqet vetëm kur zgjidhet një produkt",
  diffKg: "Diferenca në kg shfaqet vetëm kur zgjidhet një produkt"
};
const SELECTION_HINTS = {
  average: "Kosto për kg shfaqet vetëm kur të zgjedhurat janë të një produkti",
  diffKg: "Diferenca në kg shfaqet vetëm kur të zgjedhurat janë të një produkti"
};

// The difference line's lekë: red for a loss (more bought than sold), green for a profit.
const moneyClass = line => (line.shuma < 0 ? " neg" : line.difference && line.shuma > 0 ? " pos" : "");

const money = v => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kg = v => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 3 });

function TotalsRow({ line, oneProduct, hints }) {
  return (
    <tr className={line.difference ? "dtTotalsDiff" : undefined}>
      <td colSpan={LABEL_COLUMNS}>{line.label}</td>
      <td className={`num${line.sasia < 0 ? " neg" : ""}`} title={line.sasia == null ? hints.diffKg : TJETER_HINT}>
        {line.sasia == null ? "—" : kg(line.sasia)}
      </td>
      <td className={`num${moneyClass(line)}`}>{money(line.shuma)}</td>
      <td className="num" title={line.difference ? undefined : oneProduct ? TJETER_HINT : hints.average}>
        {line.average == null ? "—" : money(line.average)}
      </td>
      <td />
    </tr>
  );
}

/**
 * Totals rows under the dashboard table: Hyrje and Dalje, or only the action the Veprimi filter
 * picks, and their difference.
 * While rows are selected (`selectedRows`), the lines add up only those. Otherwise, while
 * `showFilterTotals`, they cover every entry matching the filters, not only the page on screen;
 * they keep loading during a selection, so they're ready when it's cleared.
 * `reloadKey` changes when an entry is added, edited or deleted, so the totals are worked out again.
 */
export default function DitorTotals({ filters, reloadKey, showFilterTotals, selectedRows }) {
  const [retries, setRetries] = useState(0);
  // { key, filters, totals } or { key, error }: `key` says which request the result answers.
  const [result, setResult] = useState(null);
  const key = JSON.stringify([filters, reloadKey, retries]);

  useEffect(() => {
    if (!showFilterTotals) return;
    let current = true;
    fetchEntryTotals(filters).then(
      totals => current && setResult({ key, filters, totals }),
      err => current && setResult({ key, error: err.message || String(err) })
    );
    return () => {
      current = false;
    };
  }, [filters, key, showFilterTotals]);

  if (selectedRows.length) {
    const lineFilters = selectionFilters(selectedRows, filters);
    const oneProduct = Boolean(lineFilters.produkti_id);
    const lines = totalsLines(entryTotals(selectedRows), lineFilters, { selected: true });
    return (
      <tfoot className="dtTotals">
        {lines.map(line => (
          <TotalsRow key={line.key} line={line} oneProduct={oneProduct} hints={SELECTION_HINTS} />
        ))}
      </tfoot>
    );
  }

  if (!showFilterTotals) return null;

  // Until the new totals arrive, the old ones stay on screen, dimmed.
  const stale = result?.key !== key;

  // Nothing to show yet: placeholders shaped like the totals rows.
  if (!result || (result.error && stale)) {
    return (
      <tfoot className="dtTotals" aria-busy="true">
        {totalsLines(entryTotals([]), filters).map((line, i) => (
          <tr key={line.key}>
            <td colSpan={LABEL_COLUMNS}>
              {i === 0 && <span className="sr-only" role="status">Duke llogaritur totalet…</span>}
              <Skeleton width={190} />
            </td>
            <td className="num"><Skeleton width={80} /></td>
            <td className="num"><Skeleton width={100} /></td>
            <td className="num"><Skeleton width={50} /></td>
            <td />
          </tr>
        ))}
      </tfoot>
    );
  }

  if (result.error) {
    return (
      <tfoot className="dtTotals">
        <tr>
          <td colSpan={ALL_COLUMNS} className="dtTotalsNote dtError">
            Totalet nuk u llogaritën: {result.error}
            <button className="dtRetryBtn" onClick={() => setRetries(n => n + 1)}>
              Provo përsëri
            </button>
          </td>
        </tr>
      </tfoot>
    );
  }

  // The lines follow the filters the totals were worked out for, so stale ones stay consistent.
  return (
    <tfoot className={`dtTotals${stale ? " is-stale" : ""}`}>
      {totalsLines(result.totals, result.filters).map(line => (
        <TotalsRow key={line.key} line={line} oneProduct={Boolean(result.filters.produkti_id)} hints={FILTER_HINTS} />
      ))}
    </tfoot>
  );
}
