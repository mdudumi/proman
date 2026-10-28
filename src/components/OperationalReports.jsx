import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { CATEGORY_IDS } from "../lib/categoryIds";
import { fetchAllEntries } from "../lib/ditorEntries";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import SearchSelect from "./SearchSelect";
import DatePicker from "./DatePicker";
import { TABLE_MARGIN, contentBox, drawContinuationBand, drawFooter, drawTitleBand } from "../lib/pdfPage";
import "./OperationalReports.css";

const number = value => Number(value || 0);
const money = value => number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLabel = value => {
  const [year, month, day] = String(value || "").split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
};

// Tjetër entries are money movements (reconciliations, bank, cash, VAT), not goods.
const isTjeter = row => row.kategoria?.id === CATEGORY_IDS.TJETER;
// They keep their lekë amount everywhere, but have no kilograms and no unit price.
const qty = (row, value) => (row.tjeter ? "—" : money(value));
const unitCost = (row, value, kg) => (row.tjeter ? "—" : money(kg ? value / kg : 0));
const TJETER_NOTES = {
  daily: "Regjistrimet e kategorisë Tjetër (lëvizje parash) shfaqen vetëm me shumën, pa sasi dhe pa kosto për njësi.",
  stock: "Regjistrimet e kategorisë Tjetër (lëvizje parash) llogariten me shumën, pa sasi dhe pa kosto për njësi."
};

export default function OperationalReports() {
  const [view, setView] = useState("daily");
  const [rows, setRows] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [buyer, setBuyer] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloads, setReloads] = useState(0);
  const [savingClosing, setSavingClosing] = useState(false);

  useEffect(() => {
    let current = true;
    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        const [entries, buyerRows] = await Promise.all([
          // Every entry, in batches: one request returns at most 1,000.
          fetchAllEntries({}),
          supabase.from("kategoria_list").select("id,name").eq("kategoria_id", CATEGORY_IDS.BLERESI_SHITESI).eq("is_active", true).order("name")
        ]);
        if (buyerRows.error) console.error(buyerRows.error);
        if (!current) return;
        setRows(entries);
        setBuyers(buyerRows.data || []);
      } catch (err) {
        console.error(err);
        if (current) setLoadError(err.message || String(err));
      }
      if (current) setLoading(false);
    }
    load();
    return () => {
      current = false;
    };
  }, [reloads]);

  const filtered = useMemo(() => rows.filter(row =>
    (!from || row.data >= from) && (!to || row.data <= to) && (!buyer || row.bleresi?.id === buyer)
  ), [rows, from, to, buyer]);

  const daily = useMemo(() => {
    const map = new Map();
    filtered.forEach(row => {
      const key = `${row.data}|${row.produkti?.id || ""}`;
      const current = map.get(key) || { data: row.data, produkti: row.produkti?.name || "Pa produkt", kategoria: row.kategoria?.name || "", tjeter: isTjeter(row), hyrjeSasi: 0, hyrjeVlere: 0, daljeSasi: 0, daljeVlere: 0 };
      const isIn = row.veprimi === "Hyrje/Blerje";
      if (!current.tjeter) current[isIn ? "hyrjeSasi" : "daljeSasi"] += number(row.sasia);
      current[isIn ? "hyrjeVlere" : "daljeVlere"] += number(row.shuma_leke);
      map.set(key, current);
    });
    return [...map.values()];
  }, [filtered]);

  const stock = useMemo(() => {
    const map = new Map();
    filtered.forEach(row => {
      const key = row.produkti?.id || row.produkti?.name || "";
      const current = map.get(key) || { produktiId: row.produkti?.id, kategoriaId: row.kategoria?.id, produkti: row.produkti?.name || "Pa produkt", kategoria: row.kategoria?.name || "", tjeter: isTjeter(row), sasi: 0, vlere: 0, hyrje: 0, dalje: 0 };
      const sign = row.veprimi === "Hyrje/Blerje" ? 1 : -1;
      if (!current.tjeter) current.sasi += sign * number(row.sasia);
      current.vlere += sign * number(row.shuma_leke);
      current[sign === 1 ? "hyrje" : "dalje"] += number(row.shuma_leke);
      map.set(key, current);
    });
    return [...map.values()].sort((a, b) => a.kategoria.localeCompare(b.kategoria) || a.produkti.localeCompare(b.produkti));
  }, [filtered]);

  const ledger = useMemo(() => {
    const map = new Map();
    filtered.forEach(row => {
      const key = row.bleresi?.id || "";
      const current = map.get(key) || { bleresi: row.bleresi?.name || "Pa blerës/shitës", hyrje: 0, dalje: 0 };
      current[row.veprimi === "Hyrje/Blerje" ? "hyrje" : "dalje"] += number(row.shuma_leke);
      map.set(key, current);
    });
    return [...map.values()].map(row => ({ ...row, detyrim: row.hyrje - row.dalje }));
  }, [filtered]);

  const dailySummary = useMemo(() => daily.reduce((total, row) => ({
    hyrjeSasi: total.hyrjeSasi + row.hyrjeSasi,
    hyrjeVlere: total.hyrjeVlere + row.hyrjeVlere,
    daljeSasi: total.daljeSasi + row.daljeSasi,
    daljeVlere: total.daljeVlere + row.daljeVlere,
    // Average prices use goods only.
    hyrjeVlereMall: total.hyrjeVlereMall + (row.tjeter ? 0 : row.hyrjeVlere),
    daljeVlereMall: total.daljeVlereMall + (row.tjeter ? 0 : row.daljeVlere)
  }), { hyrjeSasi: 0, hyrjeVlere: 0, daljeSasi: 0, daljeVlere: 0, hyrjeVlereMall: 0, daljeVlereMall: 0 }), [daily]);

  const stockSummary = useMemo(() => stock.reduce((total, row) => ({
    hyrje: total.hyrje + row.hyrje,
    dalje: total.dalje + row.dalje,
    sasi: total.sasi + row.sasi,
    vlere: total.vlere + row.vlere,
    // The average price per kg uses goods only.
    vlereMall: total.vlereMall + (row.tjeter ? 0 : row.vlere)
  }), { hyrje: 0, dalje: 0, sasi: 0, vlere: 0, vlereMall: 0 }), [stock]);

  const ledgerSummary = useMemo(() => ledger.reduce((total, row) => ({
    hyrje: total.hyrje + row.hyrje,
    dalje: total.dalje + row.dalje,
    detyrim: total.detyrim + row.detyrim
  }), { hyrje: 0, dalje: 0, detyrim: 0 }), [ledger]);

  const title = view === "daily" ? "Përmbledhja ditore e faturave" : view === "stock" ? "Gjendja sipas artikullit" : "Llogaria me blerësit / shitësit";
  const metrics = view === "daily"
    ? [
        ["Sasia hyrje", money(dailySummary.hyrjeSasi)], ["Vlera hyrje", money(dailySummary.hyrjeVlere)],
        ["Sasia dalje", money(dailySummary.daljeSasi)], ["Vlera dalje", money(dailySummary.daljeVlere)],
        ["Kosto mes. hyrje", money(dailySummary.hyrjeSasi ? dailySummary.hyrjeVlereMall / dailySummary.hyrjeSasi : 0)],
        ["Kosto mes. dalje", money(dailySummary.daljeSasi ? dailySummary.daljeVlereMall / dailySummary.daljeSasi : 0)]
      ]
    : view === "stock"
      ? [["Vlera hyrje", money(stockSummary.hyrje)], ["Vlera dalje", money(stockSummary.dalje)], ["Sasia në gjendje", money(stockSummary.sasi)], ["Vlera në gjendje", money(stockSummary.vlere)], ["Kosto mesatare", money(stockSummary.sasi ? stockSummary.vlereMall / stockSummary.sasi : 0)]]
      : [["Totali hyrje", money(ledgerSummary.hyrje)], ["Totali pagesa", money(ledgerSummary.dalje)], ["Detyrimi", money(ledgerSummary.detyrim)], ["Llogari", String(ledger.length)]];

  function exportPDF() {
    const doc = new jsPDF("l", "mm", "a4");
    const box = contentBox(doc);
    const period = `Periudha: ${from ? dateLabel(from) : "Fillimi"} – ${to ? dateLabel(to) : "Sot"}`;
    const generated = new Date().toLocaleString("sq-AL");
    const headers = view === "daily"
      ? ["Data", "Kategoria", "Produkti", "Sasi hyrje", "Shuma hyrje", "Kosto/njësi hyrje", "Sasi dalje", "Shuma dalje", "Kosto/njësi dalje"]
      : view === "stock"
        ? ["Kategoria", "Produkti", "Vlera hyrje", "Vlera dalje", "Sasia në gjendje", "Vlera në gjendje", "Kosto/njësi"]
        : ["Blerësi / Shitësi", "Hyrje", "Dalje / Pagesa", "Detyrimi"];
    const body = view === "daily"
      ? daily.map(row => [dateLabel(row.data), row.kategoria, row.produkti, qty(row, row.hyrjeSasi), money(row.hyrjeVlere), unitCost(row, row.hyrjeVlere, row.hyrjeSasi), qty(row, row.daljeSasi), money(row.daljeVlere), unitCost(row, row.daljeVlere, row.daljeSasi)])
      : view === "stock"
        ? stock.map(row => [row.kategoria, row.produkti, money(row.hyrje), money(row.dalje), qty(row, row.sasi), money(row.vlere), unitCost(row, row.vlere, row.sasi)])
        : ledger.map(row => [row.bleresi, money(row.hyrje), money(row.dalje), money(row.detyrim)]);
    const totals = view === "daily"
      ? ["TOTALI", "", "", money(dailySummary.hyrjeSasi), money(dailySummary.hyrjeVlere), money(dailySummary.hyrjeSasi ? dailySummary.hyrjeVlereMall / dailySummary.hyrjeSasi : 0), money(dailySummary.daljeSasi), money(dailySummary.daljeVlere), money(dailySummary.daljeSasi ? dailySummary.daljeVlereMall / dailySummary.daljeSasi : 0)]
      : view === "stock"
        ? ["TOTALI", "", money(stockSummary.hyrje), money(stockSummary.dalje), money(stockSummary.sasi), money(stockSummary.vlere), money(stockSummary.sasi ? stockSummary.vlereMall / stockSummary.sasi : 0)]
        : ["TOTALI", money(ledgerSummary.hyrje), money(ledgerSummary.dalje), money(ledgerSummary.detyrim)];

    const bandBottom = drawTitleBand(doc, title.toUpperCase());
    doc.setTextColor(51, 65, 85);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(period, box.left, bandBottom + 6);
    doc.text(`Gjeneruar: ${generated}`, box.right, bandBottom + 6, { align: "right" });
    if (buyer) doc.text(`Blerësi / Shitësi: ${buyers.find(item => item.id === buyer)?.name || ""}`, box.left, bandBottom + 11);

    // Summary boxes: up to six in a row, sharing the width inside the margins; more wrap to a new row.
    const metricsTop = bandBottom + (buyer ? 15 : 10);
    const perRow = Math.min(metrics.length, 6);
    const gap = 4;
    const metricWidth = (box.width - gap * (perRow - 1)) / perRow;
    const metricHeight = 15;
    const metricRows = Math.ceil(metrics.length / perRow);
    metrics.forEach(([label, value], index) => {
      const x = box.left + (index % perRow) * (metricWidth + gap);
      const y = metricsTop + Math.floor(index / perRow) * (metricHeight + gap);
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(x, y, metricWidth, metricHeight, 1.5, 1.5, "F");
      doc.setTextColor(71, 85, 105);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.text(label, x + 3, y + 5);
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.text(value, x + 3, y + 11);
    });
    autoTable(doc, {
      startY: metricsTop + metricRows * (metricHeight + gap) + 1,
      head: [headers],
      body,
      foot: totals ? [totals] : undefined,
      showFoot: totals ? "lastPage" : "never",
      theme: "grid",
      margin: TABLE_MARGIN,
      styles: { fontSize: 7, cellPadding: 1.4, lineColor: [203, 213, 225], lineWidth: 0.1, overflow: "linebreak" },
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold", halign: "center" },
      footStyles: { fillColor: [219, 234, 254], textColor: [15, 23, 42], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didDrawPage: data => {
        if (data.pageNumber > 1) drawContinuationBand(doc, title.toUpperCase());
        drawFooter(doc, "PROMAN", `Faqja ${doc.internal.getNumberOfPages()}`);
      }
    });
    doc.save(`${title.replace(/[^a-z0-9]+/gi, "_")}_${from || "fillimi"}_${to || "sot"}.pdf`);
  }

  async function saveAnnualClosing() {
    if (!to || !stock.length || savingClosing) {
      alert("Zgjidh datën 'Në' të mbylljes dhe verifiko gjendjen para ruajtjes.");
      return;
    }
    setSavingClosing(true);
    const { data: authData } = await supabase.auth.getUser();
    const openingYear = Number(to.slice(0, 4)) + 1;
    const payload = stock
      .filter(item => item.sasi !== 0 || item.vlere !== 0)
      .map(item => ({ viti: openingYear, data_mbylljes: to, produkti_id: item.produktiId, kategoria_id: item.kategoriaId, sasia: item.sasi, vlera_leke: item.vlere, created_by: authData.user?.id }))
      .filter(item => item.produkti_id && item.kategoria_id && item.created_by);
    const { error } = await supabase.from("gjendje_vjetore").upsert(payload, { onConflict: "viti,produkti_id" });
    setSavingClosing(false);
    if (error) {
      console.error(error);
      alert("Mbyllja nuk u ruajt. Duhet të zbatohet migrimi i bazës së të dhënave para përdorimit të kësaj veçorie.");
      return;
    }
    alert(`U ruajt gjendja e ${to} si hapje për vitin ${openingYear}.`);
  }

  return <section className="op-card">
    <div className="op-header"><div><h2>{title}</h2><p>Data në rend rritës. Sasia, shuma dhe kostoja për njësi llogariten nga faturat e regjistruara.{TJETER_NOTES[view] && ` ${TJETER_NOTES[view]}`}</p></div><div className="op-actions"><button className="op-print" onClick={exportPDF}>Shkarko PDF</button>{view === "stock" && <button className="op-save" onClick={saveAnnualClosing} disabled={savingClosing}>{savingClosing ? "Duke ruajtur…" : "Ruaj mbylljen vjetore"}</button>}</div></div>
    <div className="op-tabs">
      <button className={view === "daily" ? "active" : ""} onClick={() => setView("daily")}>Faturat ditore</button>
      <button className={view === "stock" ? "active" : ""} onClick={() => setView("stock")}>Gjendja / Mbyllja</button>
      <button className={view === "ledger" ? "active" : ""} onClick={() => setView("ledger")}>Llogaritë</button>
    </div>
    <div className="op-filters"><label>Nga<DatePicker value={from} onChange={setFrom} clearable /></label><label>Në<DatePicker value={to} onChange={setTo} clearable /></label>{view === "ledger" && <label>Blerësi / Shitësi<SearchSelect value={buyer} onChange={setBuyer} options={buyers} placeholder="Të gjithë" /></label>}</div>
    {loading ? <p>Duke ngarkuar…</p> : loadError ? <p className="op-error">Të dhënat nuk u ngarkuan: {loadError}<button onClick={() => setReloads(n => n + 1)}>Provo përsëri</button></p> : <><div className="op-metrics">{metrics.map(([label, value]) => <div className="op-metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="op-table-wrap">
      {view === "daily" && <table className="op-table"><thead><tr><th>Data</th><th>Kategoria</th><th>Produkti</th><th>Sasi hyrje</th><th>Shuma hyrje</th><th>Kosto/njësi hyrje</th><th>Sasi dalje</th><th>Shuma dalje</th><th>Kosto/njësi dalje</th></tr></thead><tbody>{daily.map(row => <tr key={`${row.data}-${row.produkti}`}><td>{dateLabel(row.data)}</td><td>{row.kategoria}</td><td>{row.produkti}</td><td>{qty(row, row.hyrjeSasi)}</td><td>{money(row.hyrjeVlere)}</td><td>{unitCost(row, row.hyrjeVlere, row.hyrjeSasi)}</td><td>{qty(row, row.daljeSasi)}</td><td>{money(row.daljeVlere)}</td><td>{unitCost(row, row.daljeVlere, row.daljeSasi)}</td></tr>)}</tbody><tfoot><tr><td>TOTALI</td><td></td><td></td><td>{money(dailySummary.hyrjeSasi)}</td><td>{money(dailySummary.hyrjeVlere)}</td><td>{money(dailySummary.hyrjeSasi ? dailySummary.hyrjeVlereMall / dailySummary.hyrjeSasi : 0)}</td><td>{money(dailySummary.daljeSasi)}</td><td>{money(dailySummary.daljeVlere)}</td><td>{money(dailySummary.daljeSasi ? dailySummary.daljeVlereMall / dailySummary.daljeSasi : 0)}</td></tr></tfoot></table>}
      {view === "stock" && <table className="op-table"><thead><tr><th>Kategoria</th><th>Produkti</th><th>Vlera hyrje</th><th>Vlera dalje</th><th>Sasia (kg) – Në gjendje</th><th>Vlera (lekë) – Në gjendje</th><th>Kosto/njësi në gjendje</th></tr></thead><tbody>{stock.map(row => <tr key={row.produkti}><td>{row.kategoria}</td><td>{row.produkti}</td><td>{money(row.hyrje)}</td><td>{money(row.dalje)}</td><td>{qty(row, row.sasi)}</td><td>{money(row.vlere)}</td><td>{unitCost(row, row.vlere, row.sasi)}</td></tr>)}</tbody><tfoot><tr><td>TOTALI</td><td></td><td>{money(stockSummary.hyrje)}</td><td>{money(stockSummary.dalje)}</td><td>{money(stockSummary.sasi)}</td><td>{money(stockSummary.vlere)}</td><td>{money(stockSummary.sasi ? stockSummary.vlereMall / stockSummary.sasi : 0)}</td></tr></tfoot></table>}
      {view === "ledger" && <table className="op-table"><thead><tr><th>Blerësi / Shitësi</th><th>Hyrje</th><th>Dalje / Pagesa</th><th>Detyrimi</th></tr></thead><tbody>{ledger.map(row => <tr key={row.bleresi}><td>{row.bleresi}</td><td>{money(row.hyrje)}</td><td>{money(row.dalje)}</td><td className={row.detyrim < 0 ? "negative" : ""}>{money(row.detyrim)}</td></tr>)}</tbody><tfoot><tr><td>Totali</td><td>{money(ledgerSummary.hyrje)}</td><td>{money(ledgerSummary.dalje)}</td><td>{money(ledgerSummary.detyrim)}</td></tr></tfoot></table>}
    </div></>}
  </section>;
}
