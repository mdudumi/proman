import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { CATEGORY_IDS } from "../lib/categoryIds";
import "./DitorForm.css";

export default function DitorForm() {
  /* ================= STATE ================= */

  const [kategorite, setKategorite] = useState([]);
  const [produkte, setProdukte] = useState([]);
  const [monedha, setMonedha] = useState([]);
  const [bleresit, setBleresit] = useState([]);

  const [form, setForm] = useState({
    data: new Date().toISOString().slice(0, 10),
    kategoria_id: "",
    produkti_id: "",
    monedha_id: "",
    bleresi_shitesi_id: "",
    veprimi: "Hyrje/Blerje",
    sasia: "",
    shuma_input: ""
  });

  /* ================= LOAD KATEGORIA ================= */

  useEffect(() => {
    supabase
      .from("kategoria")
      .select("id,name")
      .order("name")
      .then(({ data }) => setKategorite(data || []));
  }, []);

  /* ================= LOAD PRODUKTE (DEPENDENT) ================= */

  useEffect(() => {
    if (!form.kategoria_id) {
      setProdukte([]);
      return;
    }

    supabase
      .from("kategoria_list")
      .select("id,name")
      .eq("kategoria_id", form.kategoria_id)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setProdukte(data || []));
  }, [form.kategoria_id]);

  /* ================= LOAD MONEDHA ================= */

  useEffect(() => {
    supabase
      .from("kategoria_list")
      .select("id,name")
      .eq("kategoria_id", CATEGORY_IDS.MONEDHA)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setMonedha(data || []));
  }, []);

  /* ================= LOAD BLERESI / SHITESI ================= */

  useEffect(() => {
    supabase
      .from("kategoria_list")
      .select("id,name")
      .eq("kategoria_id", CATEGORY_IDS.BLERESI_SHITESI)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setBleresit(data || []));
  }, []);

  /* ================= HELPERS ================= */

  function setField(name, value) {
    setForm(prev => {
      if (name === "kategoria_id") {
        return {
          ...prev,
          kategoria_id: value,
          produkti_id: "" // reset product on category change
        };
      }
      return { ...prev, [name]: value };
    });
  }

  /* ================= CALCULATIONS ================= */

  const shuma_leke = Number(form.shuma_input || 0);
  const isValid =
    form.kategoria_id &&
    form.produkti_id &&
    form.monedha_id &&
    form.bleresi_shitesi_id &&
    Number(form.sasia) > 0 &&
    shuma_leke > 0;

  /* ================= SAVE ================= */

  async function save() {
    if (!isValid) return;

    const { error } = await supabase.from("ditor").insert({
      data: form.data,
      kategoria_id: form.kategoria_id,
      produkti_id: form.produkti_id,
      monedha_id: form.monedha_id,
      bleresi_shitesi_id: form.bleresi_shitesi_id,
      veprimi: form.veprimi,
      sasia: Number(form.sasia),
      shuma_leke
    });

    if (error) {
      alert(error.message);
      return;
    }

    // reset form (keep date)
    setForm(prev => ({
      ...prev,
      kategoria_id: "",
      produkti_id: "",
      monedha_id: "",
      bleresi_shitesi_id: "",
      sasia: "",
      shuma_input: ""
    }));
  }

  /* ================= UI ================= */

  return (
    <div className="card">
      <h3>E dhënë e re</h3>

      <div className="form-grid">
        <div>
          <label>Date</label>
          <input
            type="date"
            value={form.data}
            onChange={e => setField("data", e.target.value)}
          />
        </div>

        <div>
          <label>Kategoria</label>
          <select
            value={form.kategoria_id}
            onChange={e => setField("kategoria_id", e.target.value)}
          >
            <option value="">Select</option>
            {kategorite.map(k => (
              <option key={k.id} value={k.id}>{k.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Produkti</label>
          <select
            value={form.produkti_id}
            disabled={!produkte.length}
            onChange={e => setField("produkti_id", e.target.value)}
          >
            <option value="">Select</option>
            {produkte.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Monedha</label>
          <select
            value={form.monedha_id}
            onChange={e => setField("monedha_id", e.target.value)}
          >
            <option value="">Select</option>
            {monedha.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Bleresi / Shitesi</label>
          <select
            value={form.bleresi_shitesi_id}
            onChange={e => setField("bleresi_shitesi_id", e.target.value)}
          >
            <option value="">Select</option>
            {bleresit.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Veprimi</label>
          <select
            value={form.veprimi}
            onChange={e => setField("veprimi", e.target.value)}
          >
            <option>Hyrje/Blerje</option>
            <option>Shitje/Dalje</option>
          </select>
        </div>

        <div>
          <label>Sasia</label>
          <input
            type="number"
            value={form.sasia}
            onChange={e => setField("sasia", e.target.value)}
          />
        </div>

        <div>
          <label>Shuma (ALL)</label>
          <input
            type="number"
            value={form.shuma_input}
            onChange={e => setField("shuma_input", e.target.value)}
          />
        </div>
      </div>

      <div className="actions">
        <button disabled={!isValid} onClick={save}>
          Save Entry
        </button>
      </div>
    </div>
  );
}
