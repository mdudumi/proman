import { supabase } from "./supabaseClient";
import { CATEGORY_IDS } from "./categoryIds";

// The products page (Produktet): one row per product, added up by the database
// (rpc_produktet, supabase/migrations/20261109_produktet.sql).
// `filters` is { fromDate, toDate, kategoria_id, produkti_id, monedha_id, bleresi_id }, with "" for "all".

const number = value => Number(value || 0);
const round = (value, places) => Math.round(value * 10 ** places) / 10 ** places || 0;

// A product's row from its kilograms and lekë in each direction.
function productRow({ produktiId, produkti, hyrjeSasia, hyrjeShuma, daljeSasia, daljeShuma }) {
  const perKg = (shuma, sasia) => (sasia ? shuma / sasia : null);
  // What's left in the warehouse: Hyrje minus Dalje, rounded and made 0 if -0
  const stockKg = round(hyrjeSasia - daljeSasia, 3);
  const kostoHyrje = perKg(hyrjeShuma, hyrjeSasia);
  return {
    produktiId,
    produkti: produkti || "Pa produkt",
    hyrjeKg: hyrjeSasia,
    daljeKg: daljeSasia,
    stockKg,
    // What the stock is worth: the kg left times the price per kg it was bought for (never the
    // selling price). Null without a purchase price, since there's nothing to price it by.
    stockValue: kostoHyrje == null ? null : round(stockKg * kostoHyrje, 2),
    kostoHyrje,
    kostoDalje: perKg(daljeShuma, daljeSasia),
    hyrjeShuma,
    daljeShuma,
    // Dalje minus Hyrje, as in the dashboard's Diferenca: positive is a profit
    totali: round(daljeShuma - hyrjeShuma, 2)
  };
}

/**
 * Every product with entries matching the filters, with its kilograms and lekë in and out.
 * Tjetër isn't listed: its entries are money movements, not goods, so it has no kg to show.
 */
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
  return data
    .filter(row => row.kategoria_id !== CATEGORY_IDS.TJETER)
    .map(row =>
      productRow({
        produktiId: row.produkti_id,
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

/** The footer: kilograms and lekë added up over the rows. */
export function productTotals(rows) {
  const sum = pick => rows.reduce((total, row) => total + (pick(row) ?? 0), 0);
  const hyrjeShuma = sum(row => row.hyrjeShuma);
  const daljeShuma = sum(row => row.daljeShuma);
  return {
    count: rows.length,
    hyrjeKg: round(sum(row => row.hyrjeKg), 3),
    daljeKg: round(sum(row => row.daljeKg), 3),
    stockKg: round(sum(row => row.stockKg), 3),
    stockValue: round(sum(row => row.stockValue), 2),
    hyrjeShuma: round(hyrjeShuma, 2),
    daljeShuma: round(daljeShuma, 2),
    totali: round(daljeShuma - hyrjeShuma, 2)
  };
}
