import { useEffect, useState } from "react";
import { entryTotals, fetchEntryTotals, totalsLines } from "../lib/ditorEntries";
import { Skeleton } from "./Loading";

// The dashboard table's columns: the label spans the first six (Data … Veprimi),
// then Sasia, Shuma, Kosto/Njesi, and the column with the edit and delete buttons.
const LABEL_COLUMNS = 6;
const ALL_COLUMNS = 10;

const TJETER_HINT = "Pa regjistrimet Tjetër: ato janë lëvizje parash, jo kg";
// Without a product filter the totals mix products, so they have no cost per kg (totalsLines).
const PRODUCT_HINT = "Kosto për kg shfaqet vetëm kur zgjidhet një produkt";

const money = v => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kg = v => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 3 });

/**
 * Totals rows under the dashboard table: Hyrje and Dalje, or only the action the Veprimi filter picks.
 * They cover every entry matching the filters, not only the page on screen.
 * `reloadKey` changes when an entry is added, edited or deleted, so the totals are worked out again.
 */
export default function DitorTotals({ filters, reloadKey }) {
  const [retries, setRetries] = useState(0);
  // { key, filters, totals } or { key, error }: `key` says which request the result answers.
  const [result, setResult] = useState(null);
  const key = JSON.stringify([filters, reloadKey, retries]);

  useEffect(() => {
    let current = true;
    fetchEntryTotals(filters).then(
      totals => current && setResult({ key, filters, totals }),
      err => current && setResult({ key, error: err.message || String(err) })
    );
    return () => {
      current = false;
    };
  }, [filters, key]);

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
        <tr key={line.key}>
          <td colSpan={LABEL_COLUMNS}>{line.label}</td>
          <td className="num" title={TJETER_HINT}>{kg(line.sasia)}</td>
          <td className="num">{money(line.shuma)}</td>
          <td className="num" title={result.filters.produkti_id ? TJETER_HINT : PRODUCT_HINT}>
            {line.average == null ? "—" : money(line.average)}
          </td>
          <td />
        </tr>
      ))}
    </tfoot>
  );
}
