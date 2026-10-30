import { fetchEntryTotals } from "./ditorEntries";

// The Bilanci's GRAND TOTAL and summary cards. The report function (rpc_ditor_daily_report)
// returns one row per entry, and Supabase sends at most 1,000, so adding up the rows falls short
// past that. These come added up by the database for every matching entry (rpc_ditor_totals),
// with the same arithmetic as the report's running balance:
//   opening = Hyrje − Dalje of every matching entry before "Nga" (0 without "Nga")
//   closing = opening + Hyrje − Dalje in the period
// Kg leave Tjetër out and lekë include it, as in the report.

// "2025-03-01" -> "2025-02-28"
function dayBefore(date) {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

// Takes off float noise (0.1 + 0.2), without rounding away real decimals; -0 becomes 0.
const exact = value => Math.round(value * 1e6) / 1e6 || 0;

const hyrjeMinusDalje = totals => ({
  sasia: totals["Hyrje/Blerje"].sasia - totals["Shitje/Dalje"].sasia,
  shuma: totals["Hyrje/Blerje"].shuma - totals["Shitje/Dalje"].shuma
});

/**
 * Totals for the Bilanci filters, with the GRAND TOTAL row's keys, and `count`: how many entries
 * match, so the page can say when the table shows only some of them.
 */
export async function fetchBalanceTotals(filters) {
  const [period, before] = await Promise.all([
    fetchEntryTotals(filters),
    filters.fromDate ? fetchEntryTotals({ ...filters, fromDate: "", toDate: dayBefore(filters.fromDate) }) : null
  ]);
  const hyrje = period["Hyrje/Blerje"];
  const dalje = period["Shitje/Dalje"];
  const opening = before ? hyrjeMinusDalje(before) : { sasia: 0, shuma: 0 };

  return {
    count: hyrje.count + dalje.count,
    opening_sasia: exact(opening.sasia),
    sasia_hyrje: hyrje.sasia,
    sasia_dalje: dalje.sasia,
    sasia_mbetur: exact(opening.sasia + hyrje.sasia - dalje.sasia),
    opening_shuma: exact(opening.shuma),
    shuma_hyrje: hyrje.shuma,
    shuma_dalje: dalje.shuma,
    shuma_mbetur: exact(opening.shuma + hyrje.shuma - dalje.shuma)
  };
}
