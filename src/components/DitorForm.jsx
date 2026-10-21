import { useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { supabase } from "../lib/supabaseClient";
import { CATEGORY_IDS, SYSTEM_CATEGORY_IDS } from "../lib/categoryIds";
import SearchSelect from "./SearchSelect";
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

  const initialKategoriaId = initialData?.kategoria_id;

  useEffect(() => {
    supabase.from("kategoria").select("id,name").order("name")
      .then(({ data, error }) => {
        if (error) console.error(error);
        // System categories stay out of the list, except the one of an entry being edited.
        setKategorite((data || []).filter(k => !SYSTEM_CATEGORY_IDS.includes(k.id) || k.id === initialKategoriaId));
      });
  }, [initialKategoriaId]);

  useEffect(() => {
    supabase.from("kategoria_list").select("id,name")
      .eq("kategoria_id", CATEGORY_IDS.MONEDHA)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data, error }) => {
        if (error) console.error(error);
        setMonedha(data || []);
        const defaultId = (data || []).find(item => item.name.trim().toLocaleLowerCase() === "leke kesh")?.id;
        if (mode === "create" && defaultId) setForm(prev => ({ ...prev, monedha_id: prev.monedha_id || defaultId }));
      });
  }, [mode]);

  useEffect(() => {
    supabase.from("kategoria_list").select("id,name")
      .eq("kategoria_id", CATEGORY_IDS.BLERESI_SHITESI)
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data, error }) => {
        if (error) console.error(error);
        setBleresit(data || []);
        const defaultId = (data || []).find(item => item.name.trim().toLocaleLowerCase() === "blerje nga fshataret")?.id;
        if (mode === "create" && defaultId) setForm(prev => ({ ...prev, bleresi_shitesi_id: prev.bleresi_shitesi_id || defaultId }));
      });
  }, [mode]);

  useEffect(() => {
    // Either field can be picked first: a category narrows the product list, a product fills in its category.
    // Tjetër's items load too, so an existing Tjetër entry still shows its product when edited.
    supabase.from("kategoria_list").select("id,name,kategoria_id")
      .eq("is_active", true)
      .not("kategoria_id", "in", `(${CATEGORY_IDS.MONEDHA},${CATEGORY_IDS.BLERESI_SHITESI})`)
      .order("name")
      .then(({ data, error }) => {
        if (error) console.error(error);
        setProdukte(data || []);
      });
  }, []);

  // Without a category, list the products of every category shown in the Kategoria list.
  const kategoriaProdukte = form.kategoria_id
    ? produkte.filter(p => String(p.kategoria_id) === String(form.kategoria_id))
    : produkte.filter(p => kategorite.some(k => String(k.id) === String(p.kategoria_id)));

  function setField(name, value) {
    setForm(prev => {
      if (name === "produkti_id") {
        const produkti = produkte.find(p => String(p.id) === String(value));
        return { ...prev, produkti_id: value, kategoria_id: produkti?.kategoria_id ?? prev.kategoria_id };
      }
      if (name === "kategoria_id") {
        // Keep the product only if it belongs to the new category.
        const produkti = produkte.find(p => String(p.id) === String(prev.produkti_id));
        const keepProdukti = produkti && String(produkti.kategoria_id) === String(value);
        return { ...prev, kategoria_id: value, produkti_id: keepProdukti ? prev.produkti_id : "" };
      }
      return { ...prev, [name]: value };
    });
  }

  // 👉 values
  const sasia = Number(form.sasia || 0);
  const shuma_leke = Number(form.shuma_input || 0);

  // 👉 calculated field
  const cmimi_njesi =
    sasia > 0 ? (shuma_leke / sasia).toFixed(2) : "";

  const isValid =
    form.kategoria_id &&
    form.produkti_id &&
    form.monedha_id &&
    form.bleresi_shitesi_id &&
    sasia > 0 &&
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
      sasia,
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
        produkti_id: "",
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
            <SearchSelect
              value={form.kategoria_id}
              onChange={value => setField("kategoria_id", value)}
              options={kategorite}
            />
          </div>

          <div className="field">
            <label>Produkti</label>
            <SearchSelect
              value={form.produkti_id}
              onChange={value => setField("produkti_id", value)}
              options={kategoriaProdukte}
            />
          </div>

          <div className="field">
            <label>Monedha</label>
            <SearchSelect
              value={form.monedha_id}
              onChange={value => setField("monedha_id", value)}
              options={monedha}
            />
          </div>

          <div className="field field--span2">
            <label>Blerësi / Shitësi</label>
            <SearchSelect
              value={form.bleresi_shitesi_id}
              onChange={value => setField("bleresi_shitesi_id", value)}
              options={bleresit}
            />
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

          {/* 👉 NEW FIELD */}
          <div className="field">
            <label>
              Çmimi për njësi (ALL)
            </label>
            <input
              type="number"
              value={cmimi_njesi}
              readOnly
              className="input-readonly"
            />
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
