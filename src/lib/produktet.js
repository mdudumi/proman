import { supabase } from "./supabaseClient";
import { CATEGORY_IDS } from "./categoryIds";

// The products page (Produktet): one row per product, added up by the database
// (rpc_produktet, supabase/migrations/20261109_produktet.sql).
// `filters` is { fromDate, toDate, kategoria_id, produkti_id, monedha_id, bleresi_id }, with "" for "all".

const number = value => Number(value || 0);
const round = (value, places) => Math.round(value * 10 ** places) / 10 ** places || 0;

// A product's row from its kilograms and lekë in each direction. Tjetër entries are money
// movements, so for them every kg figure is null: their lekë stay, and nothing counts as kg.
function productRow({ produktiId, kategoriaId, produkti, hyrjeSasia, hyrjeShuma, daljeSasia, daljeShuma }) {
  const tjeter = kategoriaId === CATEGORY_IDS.TJETER;
  const kg = value => (tjeter ? null : value);
  const perKg = (shuma, sasia) => (tjeter || !sasia ? null : shuma / sasia);
  return {
    produktiId,
    kategoriaId,
    produkti: produkti || "Pa produkt",
    tjeter,
    hyrjeKg: kg(hyrjeSasia),
    daljeKg: kg(daljeSasia),
    // What's left in the warehouse: Hyrje minus Dalje, rounded and made 0 if -0
    stockKg: kg(round(hyrjeSasia - daljeSasia, 3)),
    kostoHyrje: perKg(hyrjeShuma, hyrjeSasia),
    kostoDalje: perKg(daljeShuma, daljeSasia),
    hyrjeShuma,
    daljeShuma,
    // Dalje minus Hyrje, as in the dashboard's Diferenca: positive is a profit
    totali: round(daljeShuma - hyrjeShuma, 2)
  };
}

/** Every product with entries matching the filters, with its kilograms and lekë in and out. */
export async function fetchProducts(filters) {
  const { data, error } = await supabase.rpc("rpc_produktet", {
    p_from_date: filters.fromDate || null,
    p_to_date: filters.toDate || null,
    p_kategoria_id: filters.kategoria_id || null,
    p_produkti_id: filters.produkti_id || null,
    p_monedha_id: filters.monedha_id || null,
    p_bleresi_id: filters.bleresi_id || null
  });
  if (error) throw error;
  return data.map(row =>
    productRow({
      produktiId: row.produkti_id,
      kategoriaId: row.kategoria_id,
      produkti: row.produkti,
      hyrjeSasia: number(row.hyrje_sasia),
      hyrjeShuma: number(row.hyrje_shuma),
      daljeSasia: number(row.dalje_sasia),
      daljeShuma: number(row.dalje_shuma)
    })
  );
}

const byName = (a, b) => a.produkti.localeCompare(b.produkti);

/**
 * The rows sorted by `sort` = { key, dir }, with dir "asc" or "desc". Without a key they go by
 * product name. Rows with nothing in the sorted column (null, shown as "—") come last
 * either way, and equal rows keep the product name order.
 */
export function sortProducts(rows, { key, dir }) {
  const sorted = [...rows];
  if (!key) return sorted.sort(byName);
  const sign = dir === "asc" ? 1 : -1;
  return sorted.sort((a, b) => {
    const x = a[key];
    const y = b[key];
    if (x == null || y == null) return (x == null) - (y == null) || byName(a, b);
    const order = typeof x === "string" ? x.localeCompare(y) : x - y;
    return order * sign || byName(a, b);
  });
}

/** The footer: kilograms and lekë added up over the rows. Kg are goods only, as Tjetër rows have none. */
export function productTotals(rows) {
  const sum = pick => rows.reduce((total, row) => total + (pick(row) ?? 0), 0);
  const hyrjeShuma = sum(row => row.hyrjeShuma);
  const daljeShuma = sum(row => row.daljeShuma);
  return {
    count: rows.length,
    hyrjeKg: round(sum(row => row.hyrjeKg), 3),
    daljeKg: round(sum(row => row.daljeKg), 3),
    hyrjeShuma: round(hyrjeShuma, 2),
    daljeShuma: round(daljeShuma, 2),
    totali: round(daljeShuma - hyrjeShuma, 2)
  };
}
