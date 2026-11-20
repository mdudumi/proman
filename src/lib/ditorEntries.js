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

// Every Veprimi an entry can have, in the order the dropdowns list them. The database accepts
// only these (ditor_veprimi_check).
export const VEPRIMI_OPTIONS = ["Hyrje/Blerje", "Shitje/Dalje", "Import", "Export"];

// Import counts as a Hyrje (goods in, money paid) and Export as a Dalje (goods out, money
// received), in every total, stock and account, the database functions too
// (supabase/migrations/20261119_import_export.sql).
const DIRECTION = { Import: "Hyrje/Blerje", Export: "Shitje/Dalje" };

// The VEPRIME line a Veprimi counts in.
export const direction = veprimi => DIRECTION[veprimi] || veprimi;

// Money that came in to the owner: goods sold (a Dalje or an Export), or a Tjetër Hyrje, which is
// a payment received. Goods bought and a Tjetër Dalje, a payment made, are money that went out.
export const isMoneyIn = row =>
  isTjeterEntry(row) ? direction(row.veprimi) === "Hyrje/Blerje" : direction(row.veprimi) === "Shitje/Dalje";

// The two directions the totals go by.
export const VEPRIME = [
  { value: "Hyrje/Blerje", label: "Hyrje" },
  { value: "Shitje/Dalje", label: "Dalje" }
];

// Totals per direction (Hyrje with the Imports, Dalje with the Exports): number of entries,
// kilograms and lekë.
// A Tjetër entry's lekë counts, but its quantity is not kilograms, so it's left out of
// `sasia`; `shumaMall` holds the goods-only lekë that the average price per kg uses, and
// `countMall` the number of goods entries. Tjetër's share of a line is the rest.
export function entryTotals(rows) {
  const totals = Object.fromEntries(
    VEPRIME.map(v => [v.value, { count: 0, countMall: 0, sasia: 0, shuma: 0, shumaMall: 0 }])
  );

  for (const row of rows) {
    const line = totals[direction(row.veprimi)];
    if (!line) continue;
    const shuma = Number(row.shuma_leke || 0);
    line.count += 1;
    line.shuma += shuma;
    if (!isTjeterEntry(row)) {
      line.countMall += 1;
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
// The Dalje line is `moneyIn`: its lekë came in, so they get a "+".
// Filtered to Import or Export, the one line is named after it: it holds only those entries.
// With one Blerësi/Shitësi, each total gets a `share` line under it with its Tjetër (money)
// part, and the last line is the balance with that party instead. For a buyer (sold more goods
// to than bought from) it's Hyrje - Dalje: his payments minus the goods, TVSH and reconciliations
// charged to him. For a supplier it's Dalje - Hyrje: the payments to him minus what he charged.
// Either way + means paid in advance, - still to be paid. Its kg follow the Diferenca.
export function totalsLines(totals, filters, { selected = false } = {}) {
  const oneProduct = Boolean(filters.produkti_id);
  const oneParty = Boolean(filters.bleresi_id);
  const picked = filters.veprimi && direction(filters.veprimi);
  const shown = VEPRIME.filter(v => !picked || v.value === picked);
  const entries = n => {
    const one = n === 1;
    return `${n.toLocaleString("en-US")} ${one ? "regjistrim" : "regjistrime"}${selected ? (one ? " i zgjedhur" : " të zgjedhura") : ""}`;
  };
  // Rounded, and -0 made 0, so float noise can't show up as -0
  const roundLeke = value => Math.round(value * 100) / 100 || 0;

  const lines = [];
  for (const v of shown) {
    const line = totals[v.value];
    const name = filters.veprimi && filters.veprimi !== v.value ? filters.veprimi : v.label;
    lines.push({
      key: v.value,
      label: `Totali ${name} (${entries(line.count)})`,
      sasia: line.sasia,
      shuma: line.shuma,
      average: oneProduct ? averagePerKg(line) : null,
      moneyIn: v.value === "Shitje/Dalje"
    });
    // `countMall` is null when the database totals didn't count the goods entries.
    const tjeterCount = line.countMall == null ? null : line.count - line.countMall;
    const tjeterLeke = roundLeke(line.shuma - line.shumaMall);
    if (oneParty && (tjeterCount == null ? tjeterLeke !== 0 : tjeterCount > 0)) {
      lines.push({
        key: `${v.value}-tjeter`,
        label: `nga të cilat Tjetër${tjeterCount == null ? "" : ` (${entries(tjeterCount)})`}`,
        sasia: null,
        shuma: tjeterLeke,
        average: null,
        share: true
      });
    }
  }

  if (shown.length === 2) {
    const [hyrje, dalje] = VEPRIME.map(v => totals[v.value]);
    const sasia = oneProduct ? Math.round((hyrje.sasia - dalje.sasia) * 1000) / 1000 || 0 : null;
    if (oneParty) {
      const buyer = dalje.shumaMall >= hyrje.shumaMall;
      // A plain hyphen: the PDF's built-in font has no minus sign (−), and garbles the whole line.
      const lekeLabel = buyer ? "Hyrje - Dalje" : "Dalje - Hyrje";
      lines.push({
        key: "balance",
        label: `Gjendja me ${buyer ? "blerësin" : "shitësin"} (${oneProduct ? `lekë: ${lekeLabel}, kg: Hyrje - Dalje` : lekeLabel})`,
        sasia,
        shuma: roundLeke(buyer ? hyrje.shuma - dalje.shuma : dalje.shuma - hyrje.shuma),
        average: null,
        difference: true
      });
    } else {
      lines.push({
        key: "diff",
        label: oneProduct ? "Diferenca (lekë: Dalje - Hyrje, kg: Hyrje - Dalje)" : "Diferenca (Dalje - Hyrje)",
        sasia,
        shuma: roundLeke(dalje.shuma - hyrje.shuma),
        average: null,
        difference: true
      });
    }
  }
  return lines;
}

// The filters that the totals of selected rows go by: the dashboard's, with the product only when
// every selected row is the same one, so Kosto/kg and the kg difference follow the same rule, and
// the Blerësi/Shitësi only when every selected row has the same one, for the balance line.
export function selectionFilters(rows, filters) {
  const produktiId = rows[0]?.produkti?.id;
  const oneProduct = rows.length > 0 && rows.every(row => row.produkti?.id === produktiId);
  const bleresiId = rows[0]?.bleresi?.id;
  const oneParty = Boolean(bleresiId) && rows.every(row => row.bleresi?.id === bleresiId);
  return { ...filters, produkti_id: oneProduct ? produktiId : "", bleresi_id: oneParty ? bleresiId : "" };
}

// The dashboard table's order, for entries already loaded: oldest first, as entriesQuery sorts.
export const byEntryOrder = (a, b) =>
  String(a.data ?? "").localeCompare(String(b.data ?? "")) ||
  String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) ||
  String(a.id ?? "").localeCompare(String(b.id ?? ""));

// The same totals as entryTotals, for every entry matching the filters, added up by the
// database (rpc_ditor_totals, supabase/migrations/20261026_ditor_totals.sql) instead of
// downloading the entries. It returns a row per Veprimi, so Import is added into the Hyrje line
// and Export into the Dalje line here. It doesn't count the goods entries apart, so `countMall`
// is null: fetchTotalsWithTjeter fills it in where the totals lines need it.
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
    const line = totals[direction(row.veprimi)];
    if (!line) continue;
    line.count += Number(row.regjistrime);
    line.sasia += Number(row.sasia);
    line.shuma += Number(row.shuma);
    line.shumaMall += Number(row.shuma_mall);
  }
  for (const v of VEPRIME) totals[v.value].countMall = null;
  return totals;
}

// fetchEntryTotals for the dashboard's totals lines. With one Blerësi/Shitësi they show how many
// entries of each total are Tjetër, so a second request counts the Tjetër entries, unless a
// category filter already says: Tjetër, so all of them are, or a goods category, so none is.
export async function fetchTotalsWithTjeter(filters) {
  const tjeterId = String(CATEGORY_IDS.TJETER);
  const countTjeter = Boolean(filters.bleresi_id) && !filters.kategoria_id;
  const [totals, tjeter] = await Promise.all([
    fetchEntryTotals(filters),
    countTjeter ? fetchEntryTotals({ ...filters, kategoria_id: tjeterId }) : null
  ]);
  if (!filters.bleresi_id) return totals;
  for (const v of VEPRIME) {
    const line = totals[v.value];
    const tjeterCount = tjeter ? tjeter[v.value].count : String(filters.kategoria_id) === tjeterId ? line.count : 0;
    line.countMall = line.count - tjeterCount;
  }
  return totals;
}
