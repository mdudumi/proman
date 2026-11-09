import { supabase } from "./supabaseClient";
import { CATEGORY_IDS, NOT_ENTRY_CATEGORY_IDS } from "./categoryIds";

// What the dashboard shows for each entry.
const ENTRY_SELECT = `
  id,
  data,
  veprimi,
  sasia,
  shuma_leke,
  kosto_per_njesi,
  created_at,
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

// The lists behind the filter dropdowns, shared by the dashboard and the products page.
// Each list is empty when its query fails, and the failure is logged.
export async function fetchFilterOptions() {
  const [kategoriteRes, monedhaRes, bleresitRes, produkteRes] = await Promise.all([
    supabase.from("kategoria").select("id,name").order("name"),
    supabase
      .from("kategoria_list")
      .select("id,name")
      .eq("kategoria_id", CATEGORY_IDS.MONEDHA)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("kategoria_list")
      .select("id,name")
      .eq("kategoria_id", CATEGORY_IDS.BLERESI_SHITESI)
      .eq("is_active", true)
      .order("sort_order"),
    // Either filter can be picked first: a category narrows the product list, a product fills in its category.
    supabase
      .from("kategoria_list")
      .select("id,name,kategoria_id")
      .eq("is_active", true)
      .not("kategoria_id", "in", `(${NOT_ENTRY_CATEGORY_IDS.join(",")})`)
      .order("name")
  ]);
  [kategoriteRes, monedhaRes, bleresitRes, produkteRes].forEach(res => res.error && console.error(res.error));
  return {
    kategorite: kategoriteRes.data || [],
    monedha: monedhaRes.data || [],
    bleresit: bleresitRes.data || [],
    produkte: produkteRes.data || []
  };
}

// The filters after one changes. Picking a product fills in its category, and a new category
// clears a product that doesn't belong to it.
export function withFilter(filters, name, value, produkte) {
  if (name === "produkti_id") {
    const produkti = produkte.find(p => String(p.id) === String(value));
    return { ...filters, produkti_id: value, kategoria_id: produkti?.kategoria_id ?? filters.kategoria_id };
  }
  if (name === "kategoria_id") {
    const produkti = produkte.find(p => String(p.id) === String(filters.produkti_id));
    const keepProdukti = produkti && String(produkti.kategoria_id) === String(value);
    return { ...filters, kategoria_id: value, produkti_id: keepProdukti ? filters.produkti_id : "" };
  }
  return { ...filters, [name]: value };
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
// With both lines, a third gives the difference, so nobody has to subtract by hand. Its lekë are
// Dalje minus Hyrje, from the owner's side: Hyrje is stock bought (money spent), Dalje stock sold
// (money earned), so a negative difference means more was spent than earned. They include Tjetër.
// Its kg go the other way, Hyrje minus Dalje: what's left in the warehouse, positive when more
// came in than went out. Like the average, they're null unless one product is picked: kg across
// many products says nothing useful. With `selected`, the labels say the entries are the selected ones.
export function totalsLines(totals, filters, { selected = false } = {}) {
  const oneProduct = Boolean(filters.produkti_id);
  const lines = VEPRIME.filter(v => !filters.veprimi || v.value === filters.veprimi).map(v => {
    const line = totals[v.value];
    const one = line.count === 1;
    const entries = `${line.count.toLocaleString("en-US")} ${one ? "regjistrim" : "regjistrime"}${selected ? (one ? " i zgjedhur" : " të zgjedhura") : ""}`;
    return {
      key: v.value,
      label: `Totali ${v.label} (${entries})`,
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
      label: oneProduct ? "Diferenca (lekë: Dalje - Hyrje, kg: Hyrje - Dalje)" : "Diferenca (Dalje - Hyrje)",
      // Rounded, and -0 made 0, so float noise can't show up as -0
      sasia: oneProduct ? Math.round((hyrje.sasia - dalje.sasia) * 1000) / 1000 || 0 : null,
      shuma: Math.round((dalje.shuma - hyrje.shuma) * 100) / 100 || 0,
      average: null,
      difference: true
    });
  }
  return lines;
}

// The filters that the totals of selected rows go by: the dashboard's, with the product only when
// every selected row is the same one, so Kosto/kg and the kg difference follow the same rule.
export function selectionFilters(rows, filters) {
  const produktiId = rows[0]?.produkti?.id;
  const oneProduct = rows.length > 0 && rows.every(row => row.produkti?.id === produktiId);
  return { ...filters, produkti_id: oneProduct ? produktiId : "" };
}

// The dashboard table's order, for entries already loaded: oldest first, as entriesQuery sorts.
export const byEntryOrder = (a, b) =>
  String(a.data ?? "").localeCompare(String(b.data ?? "")) ||
  String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) ||
  String(a.id ?? "").localeCompare(String(b.id ?? ""));

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
