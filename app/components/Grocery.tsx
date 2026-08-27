"use client";
import { useState } from "react";
import { type GroceryItem, type GroceryUnit, type GroceryCategory } from "../../lib/grocery-list";

export function Grocery({
  items,
  ready,
  weekLabel,
  onToggle,
  onAddCustom,
  onRemoveCustom,
  onOpenPlan,
}: {
  items: GroceryItem[];
  ready: boolean;
  weekLabel: string;
  onToggle: (itemKey: string) => Promise<void>;
  onAddCustom: (values: { name: string; quantity: number; unit: GroceryUnit; category: GroceryCategory }) => Promise<string>;
  onRemoveCustom: (itemKey: string) => Promise<void>;
  onOpenPlan: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [hideChecked, setHideChecked] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customQuantity, setCustomQuantity] = useState("1");
  const [customUnit, setCustomUnit] = useState<GroceryUnit>("item");
  const [customCategory, setCustomCategory] = useState<GroceryCategory>("Other");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const checkedCount = items.filter(item => item.checked).length;
  const percent = items.length ? Math.round(checkedCount / items.length * 100) : 0;
  const visibleItems = hideChecked ? items.filter(item => !item.checked) : items;
  const categoryOrder: GroceryCategory[] = ["Produce", "Meat & seafood", "Dairy & eggs", "Pantry", "Other"];
  const groups = categoryOrder
    .map(category => ({ category, items: visibleItems.filter(item => item.category === category) }))
    .filter(group => group.items.length);

  async function submitCustomItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    const saveError = await onAddCustom({
      name: customName,
      quantity: Number(customQuantity),
      unit: customUnit,
      category: customCategory,
    });
    setSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    setCustomName("");
    setCustomQuantity("1");
    setCustomUnit("item");
    setCustomCategory("Other");
    setShowAdd(false);
  }

  if (!ready) {
    return <div className="history-empty"><strong>Building your grocery list…</strong><span>MealRoute is combining ingredients from My Plan and restoring your saved checkmarks.</span></div>;
  }

  return <>
    <section className="grocery-head"><div className="grocery-icon">✓</div><div><p className="eyebrow">FROM MY PLAN · {weekLabel.toUpperCase()}</p><h2>{items.length} {items.length === 1 ? "item" : "items"} on your list</h2><p>{checkedCount} checked · Repeated planned ingredients are combined.</p></div></section>
    <div className="grocery-progress"><i><b style={{ width: `${percent}%` }} /></i><span>{percent}%</span></div>

    <div className="grocery-toolbar">
      <button type="button" className={showAdd ? "active" : ""} onClick={() => { setShowAdd(value => !value); setError(""); }}>＋ Add item</button>
      <button type="button" disabled={!checkedCount} onClick={() => setHideChecked(value => !value)}>{hideChecked ? "Show checked" : "Hide checked"}</button>
    </div>

    {showAdd && <form className="grocery-add-form" onSubmit={submitCustomItem}>
      <label className="grocery-name"><span>Item</span><input value={customName} onChange={event => setCustomName(event.target.value)} placeholder="Example: Sparkling water" maxLength={160} /></label>
      <label><span>Quantity</span><input type="number" inputMode="decimal" min="0.1" max="100000" step="0.1" value={customQuantity} onChange={event => setCustomQuantity(event.target.value)} /></label>
      <label><span>Unit</span><select value={customUnit} onChange={event => setCustomUnit(event.target.value as GroceryUnit)}><option value="item">item</option><option value="g">g</option></select></label>
      <label><span>Category</span><select value={customCategory} onChange={event => setCustomCategory(event.target.value as GroceryCategory)}>{categoryOrder.map(category => <option key={category}>{category}</option>)}</select></label>
      {error && <div className="auth-error">{error}</div>}
      <button className="primary full" type="submit" disabled={saving}>{saving ? "Saving…" : "Save grocery item"}</button>
    </form>}

    {groups.map(group => <section className="grocery-group" key={group.category}>
      <div><h3>{group.category}</h3><span>{group.items.filter(item => item.checked).length}/{group.items.length}</span></div>
      {group.items.map(item => <div className={`grocery-row ${item.checked ? "checked" : ""}`} key={item.itemKey}>
        <label>
          <input type="checkbox" checked={item.checked} onChange={() => void onToggle(item.itemKey)} />
          <i>{item.checked ? "✓" : ""}</i>
          <span><strong>{item.name}</strong><small>{groceryQuantityLabel(item)}{item.sourceType === "planned" ? " · from My Plan" : " · custom item"}</small></span>
        </label>
        {item.sourceType === "custom" && <button type="button" className="grocery-remove" onClick={() => void onRemoveCustom(item.itemKey)}>Remove</button>}
      </div>)}
    </section>)}

    {!items.length && <div className="history-empty"><strong>Your grocery list is empty.</strong><span>Add meals to My Plan and their confirmed ingredients will appear here. You can also add a custom grocery item.</span><button onClick={onOpenPlan}>Open My Plan</button></div>}
    {items.length > 0 && visibleItems.length === 0 && <div className="history-empty"><strong>Everything is checked.</strong><span>Show checked items whenever you want to review the complete list.</span><button onClick={() => setHideChecked(false)}>Show checked items</button></div>}
    <p className="grocery-note">Quantities are the combined food weights saved in My Plan. Package purchase sizes and cooked-to-raw weights can differ.</p>
  </>;
}

export function groceryQuantityLabel(item: GroceryItem) {
  const quantity = Number.isInteger(item.quantity) ? item.quantity.toLocaleString() : item.quantity.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (item.unit === "g") return `${quantity} g planned`;
  if (item.unit === "meal") return `${quantity} ${item.quantity === 1 ? "meal" : "meals"}`;
  return `${quantity} ${item.quantity === 1 ? "item" : "items"}`;
}

