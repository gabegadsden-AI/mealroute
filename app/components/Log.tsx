"use client";
import { type ManualFoodItem, packagedProductFood } from "../../lib/manual-food";
import { type SavedPackagedProduct } from "../../lib/app-utils";

export function PhotoPicker({ label, capture, onPhoto, secondary = false }: { label: string; capture?: "environment"; onPhoto: (file?: File) => void; secondary?: boolean }) {
  return <label className={`photo-picker ${secondary ? "secondary" : ""}`}>
    <input type="file" accept="image/*" capture={capture} onChange={event => onPhoto(event.target.files?.[0])} />
    <span>{capture ? "◎" : "▧"}</span>{label}
  </label>;
}

export function Log({
  onPhoto,
  notify,
  recentFoods,
  savedProducts,
  onManual,
  onBarcode,
}: {
  onPhoto: (file?: File) => void;
  notify: (s: string) => void;
  recentFoods: ManualFoodItem[];
  savedProducts: SavedPackagedProduct[];
  onManual: (mode: "search" | "saved" | "custom", food?: ManualFoodItem | null) => void;
  onBarcode: () => void;
}) {

  return <>
    <section className="log-hero"><div className="camera-orb">◎<i>✦</i></div><h2>What did you eat?</h2><p>Snap a photo and MealRoute will estimate the meal—then ask when details could make it more accurate.</p><div className="photo-actions"><PhotoPicker label="Take a photo" capture="environment" onPhoto={onPhoto} /><PhotoPicker label="Upload from library" onPhoto={onPhoto} secondary /></div><span>Nutrition values are always estimates.</span></section>
    <section className="method-grid">
      <button onClick={() => onManual("search")}><i>⌕</i><div><strong>Search food</strong><span>Find USDA foods and calculate an exact gram amount</span></div><b>›</b></button>
     <button onClick={onBarcode}><i>▣</i><div><strong>Scan a barcode</strong><span>Look up packaged foods by barcode</span></div><b>›</b></button>
      <button onClick={() => onManual("custom")}><i>✎</i><div><strong>Enter manually</strong><span>Enter a food name, grams, calories and macros</span></div><b>›</b></button>
    </section>
    <section className="section-block"><div className="section-heading"><div><p className="eyebrow">QUICK ADD</p><h2>Recent foods</h2></div>{recentFoods.length > 0 && <button onClick={() => onManual("saved")}>View all</button>}</div>
      {recentFoods.length
        ? <div className="recent-row">{recentFoods.slice(0, 4).map((food, index) => <button key={food.sourceKey} onClick={() => onManual("saved", food)}><span className={`mini-food ${index % 2 ? "berry" : "wrap"}`} />{food.name}<small>{Math.round(food.caloriesPer100g)} kcal per 100g</small></button>)}</div>
        : <div className="history-empty"><strong>No recent foods yet.</strong><span>Search or manually enter a food. After you log it, MealRoute will keep it here for faster reuse.</span><button onClick={() => onManual("search")}>Search food</button></div>}
    </section>
    {savedProducts.length > 0 && <section className="section-block"><div className="section-heading"><div><p className="eyebrow">VERIFIED PRODUCTS</p><h2>Scanned & saved</h2></div></div><div className="recent-row">{savedProducts.slice(0, 6).map((product) => { const food = packagedProductFood(product); return <button key={product.id} onClick={() => onManual("saved", food)}><span className="mini-food wrap" />{product.productName}<small>{Math.round(food.caloriesPer100g)} kcal per 100g</small></button>; })}</div></section>}
  </>;
}

