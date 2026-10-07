import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { CATEGORY_IDS } from "../lib/categoryIds";
import "./OperationalReports.css";

const number = value => Number(value || 0);
const money = value => number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLabel = value => {
  const [year, month, day] = String(value || "").split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
};

export default function OperationalReports() {
  const [view, setView] = useState("daily");
  const [rows, setRows] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [buyer, setBuyer] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingClosing, setSavingClosing] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [entries, buyerRows] = await Promise.all([
        supabase.from("ditor").select("id,data,veprimi,sasia,shuma_leke,produkti:produkti_id(id,name),kategoria:kategoria_id(id,name),bleresi:bleresi_shitesi_id(id,name)").order("data", { ascending: true }).order("created_at", { ascending: true }),
        supabase.from("kategoria_list").select("id,name").eq("kategoria_id", CATEGORY_IDS.BLERESI_SHITESI).eq("is_active", true).order("name")
      ]);
      if (entries.error) console.error(entries.error);
      if (buyerRows.error) console.error(buyerRows.error);
      setRows(entries.data || []);
      setBuyers(buyerRows.data || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => rows.filter(row =>
    (!from || row.data >= from) && (!to || row.data <= to) && (!buyer || row.bleresi?.id === buyer)
  ), [rows, from, to, buyer]);

  const daily = useMemo(() => {
    const map = new Map();
    filtered.forEach(row => {
      const key = `${row.data}|${row.produkti?.id || ""}`;
      const current = map.get(key) || { data: row.data, produkti: row.produkti?.name || "Pa produkt", kategoria: row.kategoria?.name || "", hyrjeSasi: 0, hyrjeVlere: 0, daljeSasi: 0, daljeVlere: 0 };
      const isIn = row.veprimi === "Hyrje/Blerje";
      current[isIn ? "hyrjeSasi" : "daljeSasi"] += number(row.sasia);
      current[isIn ? "hyrjeVlere" : "daljeVlere"] += number(row.shuma_leke);
      map.set(key, current);
    });
    return [...map.values()];
  }, [filtered]);

  const stock = useMemo(() => {
    const map = new Map();
    filtered.forEach(row => {
      const key = row.produkti?.id || row.produkti?.name || "";
      const current = map.get(key) || { produktiId: row.produkti?.id, kategoriaId: row.kategoria?.id, produkti: row.produkti?.name || "Pa produkt", kategoria: row.kategoria?.name || "", sasi: 0, vlere: 0, hyrje: 0, dalje: 0 };
      const sign = row.veprimi === "Hyrje/Blerje" ? 1 : -1;
      current.sasi += sign * number(row.sasia);
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

  const title = view === "daily" ? "Përmbledhja ditore e faturave" : view === "stock" ? "Gjendja sipas artikullit" : "Llogaria me blerësit / shitësit";
  const print = () => window.print();

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
    <div className="op-header"><div><h2>{title}</h2><p>Data në rend rritës. Sasia, shuma dhe kostoja për njësi llogariten nga faturat e regjistruara.</p></div><div className="op-actions"><button className="op-print" onClick={print}>Printo raportin</button>{view === "stock" && <button className="op-save" onClick={saveAnnualClosing} disabled={savingClosing}>{savingClosing ? "Duke ruajtur…" : "Ruaj mbylljen vjetore"}</button>}</div></div>
    <div className="op-tabs">
      <button className={view === "daily" ? "active" : ""} onClick={() => setView("daily")}>Faturat ditore</button>
      <button className={view === "stock" ? "active" : ""} onClick={() => setView("stock")}>Gjendja / Mbyllja</button>
      <button className={view === "ledger" ? "active" : ""} onClick={() => setView("ledger")}>Llogaritë</button>
    </div>
    <div className="op-filters"><label>Nga<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>Në<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>{view === "ledger" && <label>Blerësi / Shitësi<select value={buyer} onChange={e => setBuyer(e.target.value)}><option value="">Të gjithë</option>{buyers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}</div>
    {loading ? <p>Duke ngarkuar…</p> : <div className="op-table-wrap">
      {view === "daily" && <table className="op-table"><thead><tr><th>Data</th><th>Kategoria</th><th>Produkti</th><th>Sasi hyrje</th><th>Shuma hyrje</th><th>Kosto/njësi hyrje</th><th>Sasi dalje</th><th>Shuma dalje</th><th>Kosto/njësi dalje</th></tr></thead><tbody>{daily.map(row => <tr key={`${row.data}-${row.produkti}`}><td>{dateLabel(row.data)}</td><td>{row.kategoria}</td><td>{row.produkti}</td><td>{money(row.hyrjeSasi)}</td><td>{money(row.hyrjeVlere)}</td><td>{money(row.hyrjeSasi ? row.hyrjeVlere / row.hyrjeSasi : 0)}</td><td>{money(row.daljeSasi)}</td><td>{money(row.daljeVlere)}</td><td>{money(row.daljeSasi ? row.daljeVlere / row.daljeSasi : 0)}</td></tr>)}</tbody></table>}
      {view === "stock" && <table className="op-table"><thead><tr><th>Kategoria</th><th>Produkti</th><th>Vlera hyrje</th><th>Vlera dalje</th><th>Sasia (kg) – Në gjendje</th><th>Vlera (lekë) – Në gjendje</th><th>Kosto/njësi në gjendje</th></tr></thead><tbody>{stock.map(row => <tr key={row.produkti}><td>{row.kategoria}</td><td>{row.produkti}</td><td>{money(row.hyrje)}</td><td>{money(row.dalje)}</td><td>{money(row.sasi)}</td><td>{money(row.vlere)}</td><td>{money(row.sasi ? row.vlere / row.sasi : 0)}</td></tr>)}</tbody></table>}
      {view === "ledger" && <table className="op-table"><thead><tr><th>Blerësi / Shitësi</th><th>Hyrje</th><th>Dalje / Pagesa</th><th>Detyrimi</th></tr></thead><tbody>{ledger.map(row => <tr key={row.bleresi}><td>{row.bleresi}</td><td>{money(row.hyrje)}</td><td>{money(row.dalje)}</td><td className={row.detyrim < 0 ? "negative" : ""}>{money(row.detyrim)}</td></tr>)}</tbody><tfoot><tr><td>Totali</td><td>{money(ledger.reduce((sum, r) => sum + r.hyrje, 0))}</td><td>{money(ledger.reduce((sum, r) => sum + r.dalje, 0))}</td><td>{money(ledger.reduce((sum, r) => sum + r.detyrim, 0))}</td></tr></tfoot></table>}
    </div>}
  </section>;
}
