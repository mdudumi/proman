import { useEffect, useState } from "react";
import { VEPRIME, averagePerKg, fetchEntryTotals } from "../lib/ditorEntries";

// The dashboard table's columns: the label spans the first six (Data … Veprimi),
// then Sasia, Shuma, Kosto/Njesi, and the column with the edit and delete buttons.
const LABEL_COLUMNS = 6;
const ALL_COLUMNS = 10;

const TJETER_HINT = "Pa regjistrimet Tjetër: ato janë lëvizje parash, jo kg";

const count = n => n.toLocaleString("en-US");
const money = v => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kg = v => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 3 });

/**
 * Totals rows under the dashboard table: Hyrje and Dalje, or only the action the Veprimi filter picks.
 * They cover every entry matching the filters, not only the page on screen.
 * `reloadKey` changes when an entry is added, edited or deleted, so the totals are worked out again.
 */
export default function DitorTotals({ filters, reloadKey }) {
  const [retries, setRetries] = useState(0);
  // { key, totals } or { key, error }: `key` says which request the result answers.
  const [result, setResult] = useState(null);
  const key = JSON.stringify([filters, reloadKey, retries]);

  useEffect(() => {
    let current = true;
    fetchEntryTotals(filters).then(
      totals => current && setResult({ key, totals }),
      err => current && setResult({ key, error: err.message || String(err) })
    );
    return () => {
      current = false;
    };
  }, [filters, key]);

  // Until the new totals arrive, the old ones stay on screen, dimmed.
  const stale = result?.key !== key;

  if (!result || (result.error && stale)) {
    return (
      <tfoot className="dtTotals">
        <tr>
          <td colSpan={ALL_COLUMNS} className="dtTotalsNote">Duke llogaritur totalet…</td>
        </tr>
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

  const lines = VEPRIME.filter(v => !filters.veprimi || v.value === filters.veprimi);

  return (
    <tfoot className={`dtTotals${stale ? " is-stale" : ""}`}>
      {lines.map(v => {
        const line = result.totals[v.value];
        const average = averagePerKg(line);
        return (
          <tr key={v.value}>
            <td colSpan={LABEL_COLUMNS}>
              Totali {v.label} ({count(line.count)} regjistrime)
            </td>
            <td className="num" title={TJETER_HINT}>{kg(line.sasia)}</td>
            <td className="num">{money(line.shuma)}</td>
            <td className="num" title={TJETER_HINT}>{average == null ? "—" : money(average)}</td>
            <td />
          </tr>
        );
      })}
    </tfoot>
  );
}
