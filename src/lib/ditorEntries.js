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

// Money that came in to the owner: goods sold, or a Tjetër Hyrje, which is a payment received
// from a buyer. Goods bought and a Tjetër Dalje, a payment made, are money that went out.
export const isMoneyIn = row =>
  isTjeterEntry(row) ? row.veprimi === "Hyrje/Blerje" : row.veprimi === "Shitje/Dalje";

export const VEPRIME = [
  { value: "Hyrje/Blerje", label: "Hyrje" },
  { value: "Shitje/Dalje", label: "Dalje" }
];

// Totals per action (Hyrje, Dalje): number of entries, kilograms and lekë.
// A Tjetër entry's quantity is not kilograms, so it's left out of `sasia`. `countMall` and
// `shumaMall` count goods only, so Tjetër's share of a line is `count - countMall` entries and
// `shuma - shumaMall` lekë.
export function entryTotals(rows) {
  const totals = Object.fromEntries(
    VEPRIME.map(v => [v.value, { count: 0, countMall: 0, sasia: 0, shuma: 0, shumaMall: 0 }])
  );

  for (const row of rows) {
    const line = totals[row.veprimi];
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

// What a Tjetër entry is on each side: money received from a buyer, or money paid.
const TJETER_LABELS = { "Hyrje/Blerje": "arkëtuar", "Shitje/Dalje": "paguar" };

// Rounded, and -0 made 0, so float noise can't show up as -0.
const roundLeke = value => Math.round(value * 100) / 100 || 0;
const roundKg = value => Math.round(value * 1000) / 1000 || 0;

// The totals lines under the dashboard table and in its exports, for Hyrje and Dalje, or only the
// action the Veprimi filter picks:
// - Totali Hyrje and Totali Dalje: goods only. Hyrje is goods bought (money spent), Dalje goods
//   sold (money earned), so the Dalje lekë are marked `moneyIn`. An average price per kg only
//   means something for one product (across products it mixes, say, leaves and roots), so
//   `average` is null unless one is picked.
// - Tjetër, when there are Tjetër entries: billing, which goes the other way from goods. A Tjetër
//   Hyrje is money received from a buyer and counts +, a Tjetër Dalje is money paid and counts -.
//   When every entry is Tjetër, it's the only line: the goods lines would be zeros.
// - Diferenca, with both goods lines, so nobody has to add up by hand: lekë are Dalje - Hyrje
//   + Tjetër, so a negative difference means more was spent than earned. Its kg go the other
//   way, Hyrje - Dalje: what's left in the warehouse, positive when more came in than went out.
//   Like the average, they're null unless one product is picked: kg across many products says
//   nothing useful.
// `signed` lines show their sign and colour. With `selected`, the labels say the entries are the
// selected ones.
export function totalsLines(totals, filters, { selected = false } = {}) {
  const oneProduct = Boolean(filters.produkti_id);
  const shown = VEPRIME.filter(v => !filters.veprimi || v.value === filters.veprimi);
  const entries = n => {
    const one = n === 1;
    return `${n.toLocaleString("en-US")} ${one ? "regjistrim" : "regjistrime"}${selected ? (one ? " i zgjedhur" : " të zgjedhura") : ""}`;
  };

  const goodsCount = shown.reduce((n, v) => n + totals[v.value].countMall, 0);
  const tjeterCount = shown.reduce((n, v) => n + totals[v.value].count - totals[v.value].countMall, 0);
  const onlyTjeter =
    String(filters.kategoria_id) === String(CATEGORY_IDS.TJETER) || (tjeterCount > 0 && goodsCount === 0);

  const lines = onlyTjeter
    ? []
    : shown.map(v => {
        const line = totals[v.value];
        return {
          key: v.value,
          label: `Totali ${v.label} (${entries(line.countMall)})`,
          sasia: line.sasia,
          shuma: line.shumaMall,
          average: oneProduct ? averagePerKg(line) : null,
          moneyIn: v.value === "Shitje/Dalje"
        };
      });

  const tjeter = tjeterCount > 0 || onlyTjeter
    ? {
        key: "tjeter",
        // A plain hyphen: the PDF's built-in font has no minus sign (−), and garbles the whole line.
        label: `Tjetër: ${shown.map(v => TJETER_LABELS[v.value]).join(" - ")} (${entries(tjeterCount)})`,
        sasia: null,
        shuma: roundLeke(shown.reduce((sum, v) => {
          const line = totals[v.value];
          const amount = line.shuma - line.shumaMall;
          return v.value === "Hyrje/Blerje" ? sum + amount : sum - amount;
        }, 0)),
        average: null,
        signed: true,
        tjeter: true
      }
    : null;
  if (tjeter) lines.push(tjeter);

  if (!onlyTjeter && shown.length === 2) {
    const [hyrje, dalje] = lines;
    lines.push({
      key: "diff",
      label: oneProduct
        ? "Diferenca (lekë: Dalje - Hyrje, kg: Hyrje - Dalje)"
        : tjeter
          ? "Diferenca (Dalje - Hyrje + Tjetër)"
          : "Diferenca (Dalje - Hyrje)",
      sasia: oneProduct ? roundKg(hyrje.sasia - dalje.sasia) : null,
      shuma: roundLeke(dalje.shuma - hyrje.shuma + (tjeter?.shuma ?? 0)),
      average: null,
      signed: true,
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
// downloading the entries. All but `countMall`, which the database doesn't return:
// fetchTotalsWithTjeter adds it.
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

// fetchEntryTotals with `countMall`, for the totals lines, which show Tjetër on a line of its own.
// With no category filter, a second request counts the Tjetër entries. A category filter is
// either Tjetër, so every entry is Tjetër, or a goods category, so none is. (Picking a product
// always fills in its category.)
export async function fetchTotalsWithTjeter(filters) {
  const tjeterId = String(CATEGORY_IDS.TJETER);
  const [totals, tjeter] = await Promise.all([
    fetchEntryTotals(filters),
    filters.kategoria_id ? null : fetchEntryTotals({ ...filters, kategoria_id: tjeterId })
  ]);
  for (const v of VEPRIME) {
    const line = totals[v.value];
    const tjeterCount = tjeter
      ? tjeter[v.value].count
      : String(filters.kategoria_id) === tjeterId
        ? line.count
        : 0;
    line.countMall = line.count - tjeterCount;
  }
  return totals;
}
