// Numbers as the dashboard shows them: thousands with commas, and decimals only when a value has any.

// Lekë: 2000 -> "2,000", 2000.5 -> "2,000.50"
export function formatMoney(value) {
  const n = Number(value || 0);
  const decimals = Math.round(n * 100) % 100 === 0 ? 0 : 2;
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// Kilograms, up to three decimals: 2 -> "2", 2.5 -> "2.5", 1250.125 -> "1,250.125"
export const formatKg = value => Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 3 });

// On screen the unit goes with the number: "2 kg". The exports say kg in the column header instead.
export const withKg = value => `${formatKg(value)} kg`;
