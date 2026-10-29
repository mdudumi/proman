import { supabase } from "./supabaseClient";
import { fetchEntryTotals } from "./ditorEntries";

// The Analizat tabs, added up by the database (supabase/migrations/20261028_analizat_functions.sql).
// Faturat ditore can run to thousands of rows, so the app pages through it. Gjendja and Llogaritë
// have a row per product or per buyer/seller, a few hundred at most, so they come whole.
// `filters` is { from, to, kategoria_id, produkti_id, bleresi_id }, with "" for "all".

export const DAILY_PAGE_SIZE = 100;

// Supabase returns at most this many rows per request.
const BATCH_SIZE = 1000;

const number = value => Number(value || 0);

// The order the rows are shown in. Every column is in it, so pages never overlap or skip a row.
function dailyQuery(filters, options) {
  return supabase
    .rpc(
      "rpc_analizat_daily",
      {
        p_from_date: filters.from || null,
        p_to_date: filters.to || null,
        p_kategoria_id: filters.kategoria_id || null,
        p_produkti_id: filters.produkti_id || null
      },
      options
    )
    .order("data")
    .order("kategoria")
    .order("produkti")
    .order("produkti_id");
}

const toDailyRow = row => ({
  data: row.data,
  kategoria: row.kategoria || "",
  produkti: row.produkti || "Pa produkt",
  tjeter: row.tjeter,
  hyrjeSasi: number(row.hyrje_sasia),
  hyrjeVlere: number(row.hyrje_shuma),
  daljeSasi: number(row.dalje_sasia),
  daljeVlere: number(row.dalje_shuma)
});

/** One page of Faturat ditore, and how many rows there are in all. */
export async function fetchDailyPage({ page, ...filters }) {
  const start = (page - 1) * DAILY_PAGE_SIZE;
  const { data, error, count } = await dailyQuery(filters, { count: "exact" }).range(start, start + DAILY_PAGE_SIZE - 1);
  if (error) throw error;
  return { rows: data.map(toDailyRow), count: count || 0 };
}

/** Every row of Faturat ditore, for the PDF: the first batch says how many there are, the rest come together. */
export async function fetchAllDaily(filters) {
  const first = await dailyQuery(filters, { count: "exact" }).range(0, BATCH_SIZE - 1);
  if (first.error) throw first.error;

  const batches = Math.max(0, Math.ceil((first.count || 0) / BATCH_SIZE) - 1);
  const rest = await Promise.all(
    Array.from({ length: batches }, (_, i) => dailyQuery(filters).range((i + 1) * BATCH_SIZE, (i + 2) * BATCH_SIZE - 1))
  );
  const failed = rest.find(result => result.error);
  if (failed) throw failed.error;

  return [first, ...rest].flatMap(result => result.data).map(toDailyRow);
}

/**
 * TOTALI and the summary boxes of Faturat ditore: every row in the period, not only the page on
 * screen. The same figures as the dashboard totals (rpc_ditor_totals).
 */
export async function fetchDailyTotals(filters) {
  const totals = await fetchEntryTotals({
    fromDate: filters.from,
    toDate: filters.to,
    kategoria_id: filters.kategoria_id,
    produkti_id: filters.produkti_id
  });
  const hyrje = totals["Hyrje/Blerje"];
  const dalje = totals["Shitje/Dalje"];
  return {
    hyrjeSasi: hyrje.sasia,
    hyrjeVlere: hyrje.shuma,
    daljeSasi: dalje.sasia,
    daljeVlere: dalje.shuma,
    // Average prices use goods only.
    hyrjeVlereMall: hyrje.shumaMall,
    daljeVlereMall: dalje.shumaMall
  };
}

/** Gjendja / Mbyllja: one row per product, Hyrje minus Dalje, sorted by category and product. */
export async function fetchStock(filters) {
  const { data, error } = await supabase.rpc("rpc_analizat_stock", {
    p_from_date: filters.from || null,
    p_to_date: filters.to || null,
    p_kategoria_id: filters.kategoria_id || null,
    p_produkti_id: filters.produkti_id || null
  });
  if (error) throw error;
  return data
    .map(row => ({
      produktiId: row.produkti_id,
      kategoriaId: row.kategoria_id,
      produkti: row.produkti || "Pa produkt",
      kategoria: row.kategoria || "",
      tjeter: row.tjeter,
      sasi: number(row.sasia),
      vlere: number(row.vlera),
      hyrje: number(row.hyrje_shuma),
      dalje: number(row.dalje_shuma)
    }))
    .sort((a, b) => a.kategoria.localeCompare(b.kategoria) || a.produkti.localeCompare(b.produkti));
}

/** Llogaritë: one row per buyer/seller, with Hyrje, Dalje and Detyrimi (Hyrje minus Dalje). */
export async function fetchLedger(filters) {
  const { data, error } = await supabase.rpc("rpc_analizat_ledger", {
    p_from_date: filters.from || null,
    p_to_date: filters.to || null,
    p_bleresi_id: filters.bleresi_id || null
  });
  if (error) throw error;
  return data.map(row => ({
    bleresiId: row.bleresi_id,
    bleresi: row.bleresi || "Pa blerës/shitës",
    hyrje: number(row.hyrje),
    dalje: number(row.dalje),
    detyrim: number(row.detyrim)
  }));
}
