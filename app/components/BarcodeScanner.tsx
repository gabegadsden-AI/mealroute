use client";

import { useEffect, useRef, useState } from "react";
import {
  calculateManualNutrition,
  packagedProductFood,
  type ManualFoodItem,
} from "../lib/manual-food";

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
  onAdd: (food: ManualFoodItem, grams: number, destination: "today" | "plan") => Promise<boolean>;
};

const round1 = (v: number) => Math.round((v + Number.EPSILON) * 10) / 10;

// ─── BarcodeDetector polyfill type ───────────────────────

type BarcodeDetectorClass = {
  new (options?: { formats?: string[] }): {
    detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
  };
  getSupportedFormats(): Promise<string[]>;
};

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorClass;
  }
}

// ─── Component ───────────────────────────────────────────

export default function BarcodeScanner({ savedProducts, onSaveProduct, onAdd }: Props) {
  const [stage, setStage] = useState<"scan" | "result">("scan");
  const [barcode, setBarcode] = useState("");
  const [manualEntry, setManualEntry] = useState(false);
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState("");

  // Product data from lookup
  const [product, setProduct] = useState<LookupResult | null>(null);

  // Editable label fields (per 100g)
  const [labelName, setLabelName] = useState("");
  const [labelEnergy, setLabelEnergy] = useState("");
  const [labelUnit, setLabelUnit] = useState<"kcal" | "kJ">("kcal");
  const [labelCarbs, setLabelCarbs] = useState("");
  const [labelProtein, setLabelProtein] = useState("");
  const [labelFat, setLabelFat] = useState("");
  const [labelFibre, setLabelFibre] = useState("");

  // Grams + calculation
  const [grams, setGrams] = useState("100");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  // Camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<InstanceType<BarcodeDetectorClass> | null>(null);
  const scanningRef = useRef(true);

  // ─── Camera scanner ────────────────────────────────────

  useEffect(() => {
    if (!manualEntry || stage !== "scan") return;

    let cancelled = false;

    async function startCamera() {
      if (!("BarcodeDetector" in window) || !navigator.mediaDevices) {
        return; // Falls back to manual entry
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const formats = await window.BarcodeDetector!.getSupportedFormats();
        detectorRef.current = new window.BarcodeDetector!({
          formats: formats.includes("ean_13") ? ["ean_13", "ean_8", "upc_a", "upc_e"] : formats,
        });

        scanningRef.current = true;
        scanLoop();
      } catch {
        // Camera not available — stays in manual entry mode
      }
    }

    async function scanLoop() {
      if (!detectorRef.current || !videoRef.current || cancelled) return;

      try {
        const barcodes = await detectorRef.current.detect(videoRef.current);
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          scanningRef.current = false;
          handleBarcode(barcodes[0].rawValue);
          return;
        }
      } catch {
        // Detection error — try again next frame
      }

      if (scanningRef.current && !cancelled) {
        requestAnimationFrame(scanLoop);
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      scanningRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
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
        // Not found — let user enter label manually
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

  // Check if product is already saved
  const alreadySaved = food
    ? savedProducts.some(p => p.id === food.sourceKey.replace("label:", ""))
    : false;

  // ─── Save + Add ────────────────────────────────────────

  async function addFood(destination: "today" | "plan") {
    if (!food || !preview || adding) return;
    setAdding(true);
    setAddError("");

    // Save verified product for reuse
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

    const saved = await onAdd(food, preview.grams, destination);
    if (!saved) {
      setAddError("Could not add this food. Please try again.");
    }
    setAdding(false);
  }

  function reset() {
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
    setManualEntry(false);
  }

  // ─── Render ─────────────────────────────────────────────

  if (stage === "scan") {
    const hasCamera = "BarcodeDetector" in window && typeof navigator !== "undefined" && !!navigator.mediaDevices;

    return <div className="manual-food-editor">
      <p className="eyebrow">BARCODE SCAN</p>
      <h2>Scan a packaged food</h2>
      <p className="modal-sub">Point your camera at a product barcode. NutriPath will look up the nutrition label and let you verify the values before logging.</p>

      {hasCamera && !manualEntry && (
        <div className="barcode-camera-frame">
          <video ref={videoRef} playsInline muted autoPlay />
          <div className="barcode-overlay">
            <div className="barcode-reticle" />
          </div>
          {looking && <div className="barcode-scanning-hint">Looking up product…</div>}
        </div>
      )}

      {(!hasCamera || manualEntry) && (
        <form className="manual-search" onSubmit={submitManualBarcode}>
          <input
            type="text"
            inputMode="numeric"
            value={barcode}
            onChange={e => setBarcode(e.target.value)}
            placeholder="Enter barcode number"
            maxLength={14}
            autoFocus
          />
          <button type="submit" disabled={looking}>
            {looking ? "Looking…" : "Look up"}
          </button>
        </form>
      )}

      {hasCamera && !manualEntry && (
        <button className="text-button" onClick={() => setManualEntry(true)}>
          Enter barcode manually
        </button>
      )}

      {lookupError && <div className="auth-error">{lookupError}</div>}
    </div>;
  }

  // ─── Result / Edit stage ────────────────────────────────

  return <div className="manual-food-editor">
    <button className="goals-back" type="button" onClick={reset}>‹ Scan another</button>
    <p className="eyebrow">BARCODE RESULT</p>
    <h2>{labelName || "Unknown product"}</h2>
    {product?.brandName && <p className="manual-brand">{product.brandName}</p>}

    {product?.imageUrl && (
      <div className="barcode-product-image" style={{ backgroundImage: `url(${product.imageUrl})` }} />
    )}

    {lookupError && <div className="connection-notice"><b>Heads up</b><span>{lookupError}</span></div>}

    <div className="manual-source">
      <strong>{product?.found ? "Open Food Facts lookup" : "Manual label entry"}</strong>
      <span>Per 100g · Edit any incorrect values from the package</span>
    </div>

    <div className="barcode-label-fields">
      <label className="manual-custom-name">
        <span>Product name</span>
        <input value={labelName} onChange={e => setLabelName(e.target.value)} maxLength={160} placeholder="Product name" />
      </label>

      <div className="barcode-energy-row">
        <label>
          <span>Energy per 100g</span>
          <input type="number" inputMode="decimal" min="0" step="0.1" value={labelEnergy} onChange={e => setLabelEnergy(e.target.value)} placeholder="0" />
        </label>
        <div className="segment">
          <button type="button" className={labelUnit === "kcal" ? "active" : ""} onClick={() => setLabelUnit("kcal")}>kcal</button>
          <button type="button" className={labelUnit === "kJ" ? "active" : ""} onClick={() => setLabelUnit("kJ")}>kJ</button>
        </div>
      </div>

      <div className="barcode-macro-grid">
        <label><span>Carbs (g)</span><input type="number" inputMode="decimal" min="0" step="0.1" value={labelCarbs} onChange={e => setLabelCarbs(e.target.value)} placeholder="0" /></label>
        <label><span>Protein (g)</span><input type="number" inputMode="decimal" min="0" step="0.1" value={labelProtein} onChange={e => setLabelProtein(e.target.value)} placeholder="0" /></label>
        <label><span>Fat (g)</span><input type="number" inputMode="decimal" min="0" step="0.1" value={labelFat} onChange={e => setLabelFat(e.target.value)} placeholder="0" /></label>
        <label><span>Fibre (g)</span><input type="number" inputMode="decimal" min="0" step="0.1" value={labelFibre} onChange={e => setLabelFibre(e.target.value)} placeholder="0" /></label>
      </div>
    </div>

    <label className="manual-grams">
      <span>Amount eaten</span>
      <input type="number" inputMode="decimal" min="1" max="5000" step="0.1" value={grams} onChange={e => setGrams(e.target.value)} />
      <small>g</small>
    </label>

    {preview ? (
      <div className="manual-preview">
        <div className="manual-calories">
          <span>Calculated total</span>
          <strong>{preview.calories}<small> kcal</small></strong>
        </div>
        <div><span>Carbs</span><strong>{preview.carbs}g</strong></div>
        <div><span>Protein</span><strong>{preview.protein}g</strong></div>
        <div><span>Fat</span><strong>{preview.fat}g</strong></div>
        <div><span>Fibre</span><strong>{preview.fibre}g</strong></div>
      </div>
    ) : (
      <div className="auth-error">Enter energy per 100g and a gram amount to calculate nutrition.</div>
    )}

    {alreadySaved && <p className="goals-safety">✓ This product is already saved for reuse.</p>}

    {addError && <div className="auth-error">{addError}</div>}

    <div className="manual-add-actions">
      <button type="button" disabled={!preview || adding} onClick={() => addFood("today")}>
        {adding ? "Saving…" : "Save & Add to Today"}
      </button>
      <button type="button" disabled={!preview || adding} onClick={() => addFood("plan")}>
        Save & Add to Plan
      </button>
    </div>

    <p className="goals-safety">
      Values are calculated from the per-100g label data and your exact gram amount.
      Verified products are saved to your account for quick reuse next time.
    </p>
  </div>;
}
