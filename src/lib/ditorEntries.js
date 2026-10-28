import { supabase } from "./supabaseClient";
import { CATEGORY_IDS } from "./categoryIds";

// What the dashboard shows for each entry.
const ENTRY_SELECT = `
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
`;

// Supabase returns at most this many rows per request.
const BATCH_SIZE = 1000;

// Entries matching the dashboard filters, oldest first. The id keeps the order stable between pages.
export function entriesQuery(filters, options) {
  let q = supabase
    .from("ditor")
    .select(ENTRY_SELECT, options)
    .order("data", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (filters.fromDate) q = q.gte("data", filters.fromDate);
  if (filters.toDate) q = q.lte("data", filters.toDate);
  if (filters.kategoria_id) q = q.eq("kategoria_id", filters.kategoria_id);
  if (filters.produkti_id) q = q.eq("produkti_id", filters.produkti_id);
  if (filters.monedha_id) q = q.eq("monedha_id", filters.monedha_id);
  if (filters.bleresi_id) q = q.eq("bleresi_shitesi_id", filters.bleresi_id);
  if (filters.veprimi) q = q.eq("veprimi", filters.veprimi);

  return q;
}

// Every entry matching the filters, fetched in batches.
export async function fetchAllEntries(filters) {
  const all = [];
  for (let from = 0; ; from += BATCH_SIZE) {
    const { data, error } = await entriesQuery(filters).range(from, from + BATCH_SIZE - 1);
    if (error) throw error;
    all.push(...data);
    if (data.length < BATCH_SIZE) return all;
  }
}

// Tjetër entries are money movements (reconciliations, bank, cash, VAT), not goods.
export const isTjeterEntry = row => row.kategoria?.id === CATEGORY_IDS.TJETER;

export const VEPRIME = [
  { value: "Hyrje/Blerje", label: "Hyrje" },
  { value: "Shitje/Dalje", label: "Dalje" }
];

// Totals per action (Hyrje, Dalje): number of entries, kilograms and lekë.
// A Tjetër entry's lekë counts, but its quantity is not kilograms, so it's left out of
// `sasia`; `shumaMall` holds the goods-only lekë that the average price per kg uses.
export function entryTotals(rows) {
  const totals = Object.fromEntries(
    VEPRIME.map(v => [v.value, { count: 0, sasia: 0, shuma: 0, shumaMall: 0 }])
  );

  for (const row of rows) {
    const line = totals[row.veprimi];
    if (!line) continue;
    const shuma = Number(row.shuma_leke || 0);
    line.count += 1;
    line.shuma += shuma;
    if (!isTjeterEntry(row)) {
      line.sasia += Number(row.sasia || 0);
      line.shumaMall += shuma;
    }
  }

  return totals;
}

// Average price per kg for a totals line: goods lekë ÷ goods kilograms.
export const averagePerKg = line => (line.sasia ? line.shumaMall / line.sasia : null);

// The totals lines under the dashboard table and in its exports: Hyrje and Dalje, or only the
// action the Veprimi filter picks. An average price per kg only means something for one product
// (across products it mixes, say, leaves and roots), so `average` is null unless one is picked.
// With both lines, a third gives the difference, so nobody has to subtract by hand. Its kg are
// goods only, like the lines; its lekë include Tjetër, like Llogaritë's Detyrimi = Hyrje − Dalje.
export function totalsLines(totals, filters) {
  const oneProduct = Boolean(filters.produkti_id);
  const lines = VEPRIME.filter(v => !filters.veprimi || v.value === filters.veprimi).map(v => {
    const line = totals[v.value];
    return {
      key: v.value,
      label: `Totali ${v.label} (${line.count.toLocaleString("en-US")} regjistrime)`,
      sasia: line.sasia,
      shuma: line.shuma,
      average: oneProduct ? averagePerKg(line) : null
    };
  });

  if (lines.length === 2) {
    const [hyrje, dalje] = lines;
    lines.push({
      key: "diff",
      // A plain hyphen: the PDF's built-in font has no minus sign (−), and garbles the whole line.
      label: "Diferenca (Hyrje - Dalje)",
      // Rounded, and -0 made 0, so float noise can't show up as -0.00
      sasia: Math.round((hyrje.sasia - dalje.sasia) * 1000) / 1000 || 0,
      shuma: Math.round((hyrje.shuma - dalje.shuma) * 100) / 100 || 0,
      average: null,
      difference: true
    });
  }
  return lines;
}

// The same totals as entryTotals, for every entry matching the filters, added up by the
// database (rpc_ditor_totals, supabase/migrations/20261026_ditor_totals.sql) instead of
// downloading the entries.
export async function fetchEntryTotals(filters) {
  const { data, error } = await supabase.rpc("rpc_ditor_totals", {
    p_from_date: filters.fromDate || null,
    p_to_date: filters.toDate || null,
    p_kategoria_id: filters.kategoria_id || null,
    p_produkti_id: filters.produkti_id || null,
    p_monedha_id: filters.monedha_id || null,
    p_bleresi_id: filters.bleresi_id || null,
    p_veprimi: filters.veprimi || null
  });
  if (error) throw error;

  const totals = entryTotals([]);
  for (const row of data || []) {
    const line = totals[row.veprimi];
    if (!line) continue;
    line.count = Number(row.regjistrime);
    line.sasia = Number(row.sasia);
    line.shuma = Number(row.shuma);
    line.shumaMall = Number(row.shuma_mall);
  }
  return totals;
}
