import { useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { supabase } from "../lib/supabaseClient";
import { CATEGORY_IDS } from "../lib/categoryIds";
import "./DitorForm.css";

const DitorForm = forwardRef(function DitorForm(
  { mode = "create", initialData, onSaved, onCancel, hideBottomButton = false },
  ref
) {
  const [kategorite, setKategorite] = useState([]);
  const [produkte, setProdukte] = useState([]);
  const [monedha, setMonedha] = useState([]);
  const [bleresit, setBleresit] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(() => ({
    data: initialData?.data || new Date().toISOString().slice(0, 10),
    kategoria_id: initialData?.kategoria_id || "",
    produkti_id: initialData?.produkti_id || "",
    monedha_id: initialData?.monedha_id || "",
    bleresi_shitesi_id: initialData?.bleresi_shitesi_id || "",
    veprimi: initialData?.veprimi || "Hyrje/Blerje",
    sasia: initialData?.sasia ?? "",
    shuma_input: initialData?.shuma_leke ?? ""
  }));

  useEffect(() => {
    supabase.from("kategoria").select("id,name").order("name")
      .then(({ data, error }) => {
        if (error) console.error(error);
        setKategorite(data || []);
      });
  }, []);

  useEffect(() => {
    supabase.from("kategoria_list").select("id,name")
      .eq("kategoria_id", CATEGORY_IDS.MONEDHA)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data, error }) => {
        if (error) console.error(error);
        setMonedha(data || []);
      });
  }, []);

  useEffect(() => {
    supabase.from("kategoria_list").select("id,name")
      .eq("kategoria_id", CATEGORY_IDS.BLERESI_SHITESI)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data, error }) => {
        if (error) console.error(error);
        setBleresit(data || []);
      });
  }, []);

  useEffect(() => {
    if (!form.kategoria_id) {
      setProdukte([]);
      setForm(prev => ({ ...prev, produkti_id: "" }));
      return;
    }

    supabase.from("kategoria_list").select("id,name")
      .eq("kategoria_id", form.kategoria_id)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data, error }) => {
        if (error) console.error(error);
        setProdukte(data || []);
      });
  }, [form.kategoria_id]);

  function setField(name, value) {
    setForm(prev => {
      if (name === "kategoria_id") return { ...prev, kategoria_id: value, produkti_id: "" };
      return { ...prev, [name]: value };
    });
  }

  const shuma_leke = Number(form.shuma_input || 0);

  const isValid =
    form.kategoria_id &&
    form.produkti_id &&
    form.monedha_id &&
    form.bleresi_shitesi_id &&
    Number(form.sasia) > 0 &&
    shuma_leke > 0;

  async function save() {
    if (!isValid || saving) return;

    setSaving(true);

    const payload = {
      data: form.data,
      kategoria_id: form.kategoria_id,
      produkti_id: form.produkti_id,
      monedha_id: form.monedha_id,
      bleresi_shitesi_id: form.bleresi_shitesi_id,
      veprimi: form.veprimi,
      sasia: Number(form.sasia),
      shuma_leke
    };

    const res =
      mode === "edit"
        ? await supabase.from("ditor").update(payload).eq("id", initialData?.id)
        : await supabase.from("ditor").insert(payload);

    if (res.error) {
      alert(res.error.message);
      setSaving(false);
      return;
    }

    if (mode !== "edit") {
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

    setSaving(false);
    onSaved?.();
  }

  useImperativeHandle(
    ref,
    () => ({
      submit: () => save(),
      canSubmit: isValid && !saving,
      isSaving: saving
    }),
    [isValid, saving, form]
  );

  const isModal = mode === "edit";

  return (
    <div className={`card ${isModal ? "card--modal" : ""}`}>
      <form
        onSubmit={e => {
          e.preventDefault();
          save();
        }}
      >
        <div className={`form-grid ${isModal ? "form-grid--3col" : "form-grid--2col"}`}>
          <div className="field">
            <label>Data</label>
            <input type="date" value={form.data} onChange={e => setField("data", e.target.value)} />
          </div>

          <div className="field">
            <label>Kategoria</label>
            <select value={form.kategoria_id} onChange={e => setField("kategoria_id", e.target.value)}>
              <option value="">Select</option>
              {kategorite.map(k => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Produkti</label>
            <select
              value={form.produkti_id}
              disabled={!form.kategoria_id || !produkte.length}
              onChange={e => setField("produkti_id", e.target.value)}
            >
              <option value="">Select</option>
              {produkte.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Monedha</label>
            <select value={form.monedha_id} onChange={e => setField("monedha_id", e.target.value)}>
              <option value="">Select</option>
              {monedha.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="field field--span2">
            <label>Blerësi / Shitësi</label>
            <select value={form.bleresi_shitesi_id} onChange={e => setField("bleresi_shitesi_id", e.target.value)}>
              <option value="">Select</option>
              {bleresit.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Veprimi</label>
            <select value={form.veprimi} onChange={e => setField("veprimi", e.target.value)}>
              <option value="Hyrje/Blerje">Hyrje/Blerje</option>
              <option value="Shitje/Dalje">Shitje/Dalje</option>
            </select>
          </div>

          <div className="field">
            <label>Sasia</label>
            <input type="number" value={form.sasia} onChange={e => setField("sasia", e.target.value)} step="any" />
          </div>

          <div className="field">
            <label>Shuma (ALL)</label>
            <input type="number" value={form.shuma_input} onChange={e => setField("shuma_input", e.target.value)} step="any" />
          </div>
        </div>

        {!hideBottomButton && (
          <div className={`footer ${isModal ? "footer--modal" : ""}`}>
            <button className="btnPrimary" type="submit" disabled={!isValid || saving}>
              {saving ? "Duke ruajtur..." : isModal ? "Ruaj ndryshimet" : "Shto të dhënë"}
            </button>

            {isModal && (
              <button className="btnSecondary" type="button" onClick={onCancel}>
                Anulo
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
});

export default DitorForm;