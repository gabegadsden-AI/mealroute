"use client";

import { useEffect, useRef, useState } from "react";
import {
  calculateManualNutrition,
  type ManualFoodItem,
} from "../../lib/manual-food";
import {
  mealSlots,
  mealSlotLabels,
  type MealSlot,
} from "../../lib/weekly-plan";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";

// ─── Types ──────────────────────────────────────────────

export type SavedPackagedProduct = {
  id: string;
  productName: string;
  energyValue: number;
  energyUnit: "kcal" | "kJ";
  carbs: number;
  protein: number;
  fat: number;
  fibre: number;
  updatedAt: number;
};

type LookupResult = {
  found: boolean;
  productName?: string;
  brandName?: string;
  imageUrl?: string;
  energyValue?: number;
  energyUnit?: "kcal" | "kJ";
  carbs?: number;
  protein?: number;
  fat?: number;
  fibre?: number;
  source?: string;
  error?: string;
};

type Props = {
  savedProducts: SavedPackagedProduct[];
  onSaveProduct: (product: SavedPackagedProduct) => void;
  onAdd: (food: ManualFoodItem, grams: number, destination: "today" | "plan", plannedDate?: string, mealSlot?: MealSlot) => Promise<boolean>;
};

const round1 = (v: number) => Math.round((v + Number.EPSILON) * 10) / 10;

// ─── Component ───────────────────────────────────────────

export default function BarcodeScanner({ savedProducts, onSaveProduct, onAdd }: Props) {
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const [planDate, setPlanDate] = useState(() => { const d = new Date(); const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0"); const day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; });
  const [planSlot, setPlanSlot] = useState<MealSlot>("breakfast");
  const [stage, setStage] = useState<"scan" | "result">("scan");
  const [barcode, setBarcode] = useState("");
  const [manualEntry, setManualEntry] = useState(false);
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [cameraError, setCameraError] = useState("");

  const [product, setProduct] = useState<LookupResult | null>(null);

  const [labelName, setLabelName] = useState("");
  const [labelEnergy, setLabelEnergy] = useState("");
  const [labelUnit, setLabelUnit] = useState<"kcal" | "kJ">("kcal");
  const [labelCarbs, setLabelCarbs] = useState("");
  const [labelProtein, setLabelProtein] = useState("");
  const [labelFat, setLabelFat] = useState("");
  const [labelFibre, setLabelFibre] = useState("");

  const [grams, setGrams] = useState("100");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  // ─── Camera scanner (ZXing) ────────────────────────────

  useEffect(() => {
    if (manualEntry || stage !== "scan") return;

    let cancelled = false;

    async function startCamera() {
      try {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints);
        readerRef.current = reader;

        const devices = await navigator.mediaDevices.enumerateDevices();
        let deviceId: string | undefined;
        const videoDevices = devices.filter(d => d.kind === "videoinput");
        if (videoDevices.length > 1) {
          const backCam = videoDevices.find(d =>
            /back|rear|environment/i.test(d.label)
          );
          if (backCam) deviceId = backCam.deviceId;
        }

        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current!,
          (result, err) => {
            if (cancelled) return;
            if (result) {
              const code = result.getText();
              if (code && code.length >= 6) {
                if (controlsRef.current) {
                  controlsRef.current.stop();
                }
                handleBarcode(code);
              }
            }
          }
        );
        controlsRef.current = controls;

        if (cancelled && controls) {
          controls.stop();
        }
      } catch (err) {
        if (!cancelled) {
          setCameraError("Camera not available. Enter the barcode manually.");
          setManualEntry(true);
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (controlsRef.current) {
        try { controlsRef.current.stop(); } catch {}
        controlsRef.current = null;
      }
    };
  }, [manualEntry, stage]);

  // ─── Lookup ────────────────────────────────────────────

  async function handleBarcode(code: string) {
    setLooking(true);
    setLookupError("");
    setBarcode(code);

    try {
      const res = await fetch("/api/barcode-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode: code }),
      });
      const data = (await res.json()) as LookupResult & { error?: string };

      if (!res.ok && data.error) {
        setLookupError(data.error);
        setManualEntry(true);
        setLooking(false);
        return;
      }

      if (data.error) {
        setLookupError(data.error);
      }

      setProduct(data);

      if (data.found) {
        setLabelName(data.productName || "");
        setLabelEnergy(data.energyValue ? String(data.energyValue) : "");
        setLabelUnit(data.energyUnit || "kcal");
        setLabelCarbs(data.carbs != null ? String(data.carbs) : "");
        setLabelProtein(data.protein != null ? String(data.protein) : "");
        setLabelFat(data.fat != null ? String(data.fat) : "");
        setLabelFibre(data.fibre != null ? String(data.fibre) : "");
        setGrams("100");
        setStage("result");
      } else {
        setLabelName("");
        setLabelEnergy("");
        setLabelUnit("kcal");
        setLabelCarbs("");
        setLabelProtein("");
        setLabelFat("");
        setLabelFibre("");
        setGrams("100");
        setStage("result");
      }
    } catch {
      setLookupError("Could not look up that barcode. Enter the label values manually.");
      setManualEntry(true);
    } finally {
      setLooking(false);
    }
  }

  function submitManualBarcode(e: React.FormEvent) {
    e.preventDefault();
    const clean = barcode.replace(/\D/g, "");
    if (clean.length < 6) {
      setLookupError("Enter at least 6 digits.");
      return;
    }
    handleBarcode(clean);
  }

  // ─── Nutrition calculation ──────────────────────────────

  const energyNum = Number(labelEnergy) || 0;
  const kcalPer100g = labelUnit === "kJ" ? energyNum / 4.184 : energyNum;

  const food: ManualFoodItem | null = labelName.trim() && energyNum > 0
    ? {
        sourceKey: `label:${labelName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}`,
        sourceType: "nutrition_label",
        name: labelName.trim(),
        brandName: product?.brandName || undefined,
        caloriesPer100g: kcalPer100g,
        proteinPer100g: Number(labelProtein) || 0,
        carbsPer100g: Number(labelCarbs) || 0,
        fatPer100g: Number(labelFat) || 0,
        fibrePer100g: Number(labelFibre) || 0,
        nutritionSource: `Barcode label · ${labelName.trim()}`,
      }
    : null;

  const gramsNum = Number(grams);
  const validGrams = Number.isFinite(gramsNum) && gramsNum >= 1 && gramsNum <= 5000;
  const preview = food && validGrams ? calculateManualNutrition(food, gramsNum) : null;

  const alreadySaved = food
    ? savedProducts.some(p => p.id === food.sourceKey.replace("label:", ""))
    : false;

  // ─── Save + Add ────────────────────────────────────────

  async function addFood(destination: "today" | "plan", plannedDate?: string, mealSlot?: MealSlot) {
    if (!food || !preview || adding) return;
    setAdding(true);
    setAddError("");

    const productId = food.sourceKey.replace("label:", "");
    onSaveProduct({
      id: productId,
      productName: labelName.trim(),
      energyValue: energyNum,
      energyUnit: labelUnit,
      carbs: Number(labelCarbs) || 0,
      protein: Number(labelProtein) || 0,
      fat: Number(labelFat) || 0,
      fibre: Number(labelFibre) || 0,
      updatedAt: Date.now(),
    });

    const saved = await onAdd(food, preview.grams, destination, plannedDate, mealSlot);
    if (!saved) {
      setAddError("Could not add this food. Please try again.");
    }
    setAdding(false);
  }

  function reset() {
    if (controlsRef.current) {
      try { controlsRef.current.stop(); } catch {}
      controlsRef.current = null;
    }
    setStage("scan");
    setBarcode("");
    setProduct(null);
    setLabelName("");
    setLabelEnergy("");
    setLabelCarbs("");
    setLabelProtein("");
    setLabelFat("");
    setLabelFibre("");
    setGrams("100");
    setLookupError("");
    setAddError("");
    setCameraError("");
    setManualEntry(false);
  }

  // ─── Render ─────────────────────────────────────────────

  if (stage === "scan") {
    const cameraSupported = typeof navigator !== "undefined" && !!navigator.mediaDevices;

    return <div className="manual-food-editor">
      <p className="eyebrow">BARCODE SCAN</p>
      <h2>Scan a packaged food</h2>
      <p className="modal-sub">Point your camera at a product barcode. MealRoute will look up the nutrition label and let you verify the values before logging.</p>

      {cameraSupported && !manualEntry && (
        <div className="barcode-camera-frame">
          <video ref={videoRef} playsInline muted autoPlay />
          <div className="barcode-overlay">
            <div className="barcode-reticle" />
          </div>
          {looking && <div className="barcode-scanning-hint">Looking up product…</div>}
        </div>
      )}

      {cameraSupported && !manualEntry && (
        <button
          className="manual-toggle"
          onClick={() => {
            if (controlsRef.current) { try { controlsRef.current.stop(); } catch {} }
            setManualEntry(true);
          }}
        >
          Enter barcode manually
        </button>
      )}

      {(!cameraSupported || manualEntry) && (
        <form className="manual-search" onSubmit={submitManualBarcode}>
          <input
            type="text"
            inputMode="numeric"
            value={barcode}
            onChange={e => { setBarcode(e.target.value); setLookupError(""); }}
            placeholder="Enter barcode number"
            maxLength={14}
            autoFocus
          />
          <button type="submit" className="lookup-btn">Look up</button>
        </form>
      )}

      {lookupError && <p className="lookup-error">{lookupError}</p>}
      {cameraError && <p className="lookup-error">{cameraError}</p>}
    </div>;
  }

  // ─── Result / Edit stage ────────────────────────────────

  return <div className="manual-food-editor">
    <p className="eyebrow">{product?.found ? "PRODUCT FOUND" : "MANUAL ENTRY"}</p>
    <h2>{labelName || "Enter nutrition label"}</h2>
    {product?.found && <p className="modal-sub">Verify the values below against the package, then enter your gram amount.</p>}
    {!product?.found && <p className="modal-sub">No product found for barcode {barcode}. Enter the values from the nutrition label.</p>}
    {product?.imageUrl && (
      <div style={{ textAlign: "center", margin: "12px 0" }}>
        <img src={product.imageUrl} alt={product.productName} style={{ maxHeight: 100, borderRadius: 8 }} />
      </div>
    )}

    <div className="manual-fields">
      <label>
        <span>Product name</span>
        <input value={labelName} onChange={e => setLabelName(e.target.value)} placeholder="e.g. Nutella" />
      </label>
      <div className="macro-row">
        <label>
          <span>Energy (per 100g)</span>
          <input type="number" inputMode="decimal" value={labelEnergy} onChange={e => setLabelEnergy(e.target.value)} placeholder="e.g. 539" />
        </label>
        <label className="unit-pick">
          <span>Unit</span>
          <select value={labelUnit} onChange={e => setLabelUnit(e.target.value as "kcal" | "kJ")}>
            <option value="kcal">kcal</option>
            <option value="kJ">kJ</option>
          </select>
        </label>
      </div>
      <div className="macro-row">
        <label>
          <span>Carbs (g)</span>
          <input type="number" inputMode="decimal" value={labelCarbs} onChange={e => setLabelCarbs(e.target.value)} placeholder="0" />
        </label>
        <label>
          <span>Protein (g)</span>
          <input type="number" inputMode="decimal" value={labelProtein} onChange={e => setLabelProtein(e.target.value)} placeholder="0" />
        </label>
      </div>
      <div className="macro-row">
        <label>
          <span>Fat (g)</span>
          <input type="number" inputMode="decimal" value={labelFat} onChange={e => setLabelFat(e.target.value)} placeholder="0" />
        </label>
        <label>
          <span>Fibre (g)</span>
          <input type="number" inputMode="decimal" value={labelFibre} onChange={e => setLabelFibre(e.target.value)} placeholder="0" />
        </label>
      </div>
    </div>

    <div className="manual-grams">
      <label>
        <span>How many grams?</span>
        <input type="number" inputMode="decimal" value={grams} onChange={e => setGrams(e.target.value)} />
      </label>
      {preview && (
        <div className="preview-box">
          <strong>{labelName || "Product"}</strong>
          <div className="preview-macros">
            <span>{Math.round(preview.calories)} kcal</span>
            <span>P {round1(preview.protein)}g</span>
            <span>C {round1(preview.carbs)}g</span>
            <span>F {round1(preview.fat)}g</span>
          </div>
        </div>
      )}
    </div>

    {alreadySaved && <p className="saved-note">✓ Saved to your verified products</p>}

    <div className="manual-actions">
      <button
        className="btn-primary"
        disabled={!food || !validGrams || adding}
        onClick={() => addFood("today")}
      >
        {adding ? "Adding…" : "Add to today"}
      </button>
      <button
        className={`btn-secondary ${showPlanPicker ? "active" : ""}`}
        disabled={!food || !validGrams || adding}
        onClick={() => setShowPlanPicker(true)}
      >
        {showPlanPicker ? "Pick date & meal ↓" : "Add to plan"}
      </button>
    </div>

    {showPlanPicker && (
      <div className="plan-picker plan-picker-open">
        <div className="plan-picker-row">
          <label><span>Date</span><input type="date" value={planDate} onChange={e => setPlanDate(e.target.value)} /></label>
          <label><span>Meal</span><select value={planSlot} onChange={e => setPlanSlot(e.target.value as MealSlot)}>{mealSlots.map(s => <option key={s} value={s}>{mealSlotLabels[s]}</option>)}</select></label>
        </div>
        <div className="plan-picker-actions">
          <button className="btn-primary" disabled={!food || !validGrams || adding || !planDate} onClick={() => void addFood("plan", planDate, planSlot)}>{adding ? "Adding…" : "Schedule in plan"}</button>
          <button className="plan-picker-cancel" onClick={() => setShowPlanPicker(false)}>Cancel</button>
        </div>
      </div>
    )}

    {addError && <p className="lookup-error">{addError}</p>}

    <button className="scan-again" onClick={reset}>← Scan another barcode</button>
  </div>;
}
