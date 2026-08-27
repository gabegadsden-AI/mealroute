"use client";
import { useState, useEffect, useRef } from "react";
import { type MealRouteProfile } from "../../lib/profile";
import { type MacroTargets } from "../../lib/macro-targets";
import { type WeightLog, weightInUnit } from "../../lib/weight-progress";
import { type ManualFoodItem } from "../../lib/manual-food";
import { type SavedPackagedProduct, type FoodAnalysis, type ReviewIngredient, type LabelNutrition, type LabelNutritionDraft, type Tab } from "../../lib/app-utils";
import { GoalsEditor, MacroTargetsEditor } from "./ProfileEditors";
import { WeightProgressEditor, ManualFoodEditor, WaterEditor } from "./Progress";
import { PhotoPicker } from "./Log";
import BarcodeScanner from "./BarcodeScanner";
import { profileInitials, profileGoalLabel } from "./ProfileEditors";

export function Modal({ type, close, addWater, setWaterTotal, saveWaterGoal, water, waterGoal, waterDate, next, notify, setTab, onPhoto, uploadedPhoto, uploadedData, analysis, analyzing, analysisError, onAnalyze, onAddAnalysis, profile, target, macroTargets, onLogout, loggingOut, savedProducts, onSaveProducts, onSaveProfileGoals, onSaveProfileMacros, weightLogs, onSaveWeight, onDeleteWeight, manualStartMode, manualInitialFood, recentFoods, onAddManualFood }: any) {
  const [answers, setAnswers] = useState<string[]>([]);
  const [reviewItems, setReviewItems] = useState<ReviewIngredient[]>([]);
  const [reviewDirty, setReviewDirty] = useState(false);
  const [fixingResult, setFixingResult] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [confirmedUpdate, setConfirmedUpdate] = useState(false);
  const confirmedReviewRef = useRef<ReviewIngredient[] | null>(null);

  useEffect(() => {
    if (type !== "result" || !analysis) return;
    const confirmed = confirmedReviewRef.current;
    if (confirmed) {
      saveLabelProfiles(confirmed);
      setReviewItems(confirmed.map((ingredient, index) => {
        const recalculated = analysis.ingredients[index] || ingredient;
        return {
          ...recalculated,
          name: ingredient.name,
          amountGrams: ingredient.amountGrams,
        };
      }));
      confirmedReviewRef.current = null;
      setConfirmedUpdate(true);
    } else {
      setReviewItems(analysis.ingredients.map((item: ReviewIngredient) => ({ ...item })));
      setConfirmedUpdate(false);
    }
    setReviewDirty(false);
    setFixingResult(false);
    setEditingIndex(null);
  }, [type, analysis]);

  function saveLabelProfiles(ingredients: ReviewIngredient[]) {
    const labels = ingredients.filter(item => item.labelNutrition && labelIsComplete(item)).map(item => {
      const label = item.labelNutrition!;
      return {
        id: label.productName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `product-${Date.now()}`,
        productName: label.productName.trim(),
        energyValue: Number(label.energyValue), energyUnit: label.energyUnit,
        carbs: Number(label.carbs), protein: Number(label.protein), fat: Number(label.fat), fibre: Number(label.fibre), updatedAt: Date.now(),
      } satisfies SavedPackagedProduct;
    });
    if (!labels.length) return;
    const next: SavedPackagedProduct[] = [...(savedProducts as SavedPackagedProduct[])];
    labels.forEach(label => {
      const index = next.findIndex((item: SavedPackagedProduct) => item.id === label.id);
      if (index >= 0) next[index] = label; else next.unshift(label);
    });
    onSaveProducts(next.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50));
  }

  function updateReviewName(index: number, value: string) {
    setReviewItems(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, name: value, fdcId: undefined, nutritionSource: undefined, calculationSource: undefined } : item));
    setReviewDirty(true);
    setConfirmedUpdate(false);
  }

  function togglePackageLabel(index: number, enabled: boolean) {
    setReviewItems(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, fdcId: undefined, nutritionSource: undefined, calculationSource: undefined, labelNutrition: enabled ? { productName: item.name || "Packaged food", energyValue: "", energyUnit: "kJ", carbs: "", protein: "", fat: "", fibre: "" } : undefined } : item));
    setReviewDirty(true); setConfirmedUpdate(false);
  }

  function selectSavedProduct(index: number, productId: string) {
    const product = (savedProducts as SavedPackagedProduct[]).find(item => item.id === productId);
    if (!product) return;
    setReviewItems(items => items.map((item, itemIndex) => itemIndex === index ? {
      ...item,
      name: item.name || product.productName,
      fdcId: undefined,
      nutritionSource: undefined,
      calculationSource: undefined,
      labelNutrition: { productName: product.productName, energyValue: product.energyValue, energyUnit: product.energyUnit, carbs: product.carbs, protein: product.protein, fat: product.fat, fibre: product.fibre },
    } : item));
    setReviewDirty(true); setConfirmedUpdate(false);
  }

  function updateLabelField(index: number, field: keyof LabelNutritionDraft, rawValue: string) {
    setReviewItems(items => items.map((item, itemIndex) => {
      if (itemIndex !== index || !item.labelNutrition) return item;
      const value = field === "productName" || field === "energyUnit" ? rawValue : rawValue === "" ? "" : Math.max(0, Number(rawValue));
      return { ...item, labelNutrition: { ...item.labelNutrition, [field]: value } as LabelNutritionDraft };
    }));
    setReviewDirty(true); setConfirmedUpdate(false);
  }

  function labelIsComplete(item: ReviewIngredient) {
    const label = item.labelNutrition;
    if (!label) return true;
    const rawValues = [label.energyValue, label.carbs, label.protein, label.fat, label.fibre];
    if (rawValues.some(value => value === "")) return false;
    const values = rawValues.map(Number);
    return Boolean(label.productName.trim() && values[0] > 0 && values.every(value => Number.isFinite(value) && value >= 0));
  }

  function reviewValidationMessage() {
    if (reviewItems.length === 0) return "Add at least one ingredient.";
    if (reviewItems.some(item => !item.name.trim())) return "Enter a food name for every ingredient.";
    if (reviewItems.some(item => Number(item.amountGrams) <= 0)) return "Enter a gram amount greater than zero.";
    const incompleteLabel = reviewItems.find(item => item.labelNutrition && !labelIsComplete(item));
    if (incompleteLabel) return `Complete every package-label field for ${incompleteLabel.labelNutrition?.productName || incompleteLabel.name}. Light example text is not saved data.`;
    return "";
  }

  function updateReviewGrams(index: number, value: string) {
    const amountGrams = value === "" ? "" : Math.min(5000, Math.max(1, Math.round(Number(value) || 1)));
    setReviewItems(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, amountGrams } : item));
    setReviewDirty(true);
    setConfirmedUpdate(false);
  }

  function removeReviewItem(index: number) {
    setReviewItems(items => items.filter((_, itemIndex) => itemIndex !== index));
    setEditingIndex(null);
    setReviewDirty(true);
    setConfirmedUpdate(false);
  }

  function addReviewItem() {
    setReviewItems(items => [...items, { name: "", amountGrams: "", calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }]);
    setEditingIndex(reviewItems.length);
    setFixingResult(true);
    setReviewDirty(true);
    setConfirmedUpdate(false);
  }

  function recalculateReview() {
    const ingredients = reviewItems
      .map(item => ({ ...item, name: item.name.trim(), amountGrams: Number(item.amountGrams), labelNutrition: item.labelNutrition ? { productName: item.labelNutrition.productName.trim(), energyValue: Number(item.labelNutrition.energyValue), energyUnit: item.labelNutrition.energyUnit, carbs: Number(item.labelNutrition.carbs), protein: Number(item.labelNutrition.protein), fat: Number(item.labelNutrition.fat), fibre: Number(item.labelNutrition.fibre) } : undefined }))
      .filter(item => item.name && item.amountGrams > 0) as ReviewIngredient[];
    confirmedReviewRef.current = ingredients.map(ingredient => ({ ...ingredient }));
    setReviewItems(ingredients.map(ingredient => ({ ...ingredient })));
    onAnalyze([], { ingredients });
  }

  const reviewProblem = reviewDirty ? reviewValidationMessage() : "";

  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}><section className={`modal-sheet ${type === "result" ? "result-sheet" : ""}`}>
    <button className="modal-close" onClick={close}>×</button>
    {type === "water" && <WaterEditor water={water} goal={waterGoal} date={waterDate} onAdd={addWater} onSetTotal={setWaterTotal} onSaveGoal={saveWaterGoal} />}
    {type === "log" && <><div className="modal-icon">＋</div><p className="eyebrow">ADD FOOD</p><h2>How would you like to log?</h2><div className="modal-photo-actions"><PhotoPicker label="Take a photo" capture="environment" onPhoto={onPhoto} /><PhotoPicker label="Upload from library" onPhoto={onPhoto} secondary /></div><div className="modal-list"><button onClick={() => { close(); setTab("log"); }}><i>⌕</i><span><strong>Search or scan</strong><small>Food, meals and barcodes</small></span><b>›</b></button><button onClick={() => notify("Previous meals opened")}><i>↻</i><span><strong>Choose a previous meal</strong><small>Quickly log it again</small></span><b>›</b></button></div></>}
    {type === "scan" && <><div className={`scan-frame ${uploadedPhoto ? "has-photo" : ""}`} style={uploadedPhoto ? { backgroundImage: `url(${uploadedPhoto})` } : undefined}>{!uploadedPhoto && <div className="scan-food"><span>Photo</span><span>Upload</span><span>Preview</span></div>}<b>✓ Photo uploaded successfully</b></div><p className="eyebrow">PHOTO ANALYSIS</p><h2>Your meal photo is ready</h2><p className="modal-sub">MealRoute will identify visible foods, estimate portions and nutrition, and ask up to two questions when important details are unclear.</p>{analysisError && <div className="connection-notice"><b>Analysis couldn’t start</b><span>{analysisError}</span></div>}<button className="primary full" disabled={!uploadedData || analyzing} onClick={() => onAnalyze()}>{analyzing ? "Analyzing your meal…" : uploadedData ? "Analyze this photo" : "Preparing photo…"}</button><button className="text-button" onClick={() => next("log")}>Choose a different photo</button></>}
    {type === "clarify" && analysis && <><span className="step-label">{analysis.clarifyingQuestions.length} quick {analysis.clarifyingQuestions.length === 1 ? "question" : "questions"}</span><div className="modal-icon">?</div><h2>A little detail will improve your estimate</h2><p className="modal-sub">MealRoute identified this as <b>{analysis.mealName}</b>, with {analysis.confidence.toLowerCase()} confidence.</p><div className="question-list">{analysis.clarifyingQuestions.map((question: string, index: number) => <label key={question}><span>{question}</span><input value={answers[index] || ""} onChange={event => setAnswers(current => { const updated = [...current]; updated[index] = event.target.value; return updated; })} placeholder="Type your answer, or ‘not sure’" /></label>)}</div>{analysisError && <div className="connection-notice"><b>Couldn’t refine estimate</b><span>{analysisError}</span></div>}<button className="primary full" disabled={analyzing || analysis.clarifyingQuestions.some((_: string, index: number) => !answers[index]?.trim())} onClick={() => onAnalyze(answers)}>{analyzing ? "Refining estimate…" : "Update my estimate"}</button><button className="text-button" onClick={() => next("result")}>Use current estimate</button></>}
    {type === "result" && analysis && <>
      <div className={`result-photo ${uploadedPhoto ? "has-photo" : ""}`} style={uploadedPhoto ? { backgroundImage: `url(${uploadedPhoto})` } : undefined}>
        <div><span>{analysis.confidence} confidence</span><b>{analysis.calculationMethod === "nutrition_label" ? "Nutrition label calculation" : analysis.calculationMethod === "mixed_sources" ? "Mixed-source calculation" : analysis.calculationMethod === "verified_database" ? "Database calculation" : "AI estimate"}</b></div>
      </div>
      <div className="result-content">
        <div className="result-title-row"><div><p>SCANNED MEAL</p><h2>{analysis.mealName}</h2></div><button aria-label="Save meal for later">♡</button></div>
        <div className="calorie-summary"><strong>{analysis.calories.best}</strong><span>kcal</span><small>{analysis.calculationMethod && analysis.calculationMethod !== "ai_estimate" ? "Calculated from confirmed grams" : `${analysis.calories.low}–${analysis.calories.high} estimated range`}</small></div>
        <div className="result-macro-cards">
          <div className="carbs"><span>Carbs</span><strong>{analysis.carbs}g</strong></div>
          <div className="protein"><span>Protein</span><strong>{analysis.protein}g</strong></div>
          <div className="fat"><span>Fat</span><strong>{analysis.fat}g</strong></div>
        </div>
        {analysis.fibre > 0 && <div className="fibre-summary"><span>Fibre</span><strong>{analysis.fibre}g</strong><small>Shown separately from carbohydrates</small></div>}
        {confirmedUpdate && <div className="result-updated">✓ Changes saved — confirmed grams retained</div>}
        {analysis.uncertainties.length > 0 && <div className="result-uncertainty"><b>Estimate note</b><span>{analysis.uncertainties.join(" · ")}</span></div>}
        <div className="result-section-heading"><div><h3>Ingredients</h3><span>{reviewItems.length} detected</span></div><button className={fixingResult ? "active" : ""} onClick={() => { setFixingResult(value => !value); setEditingIndex(null); }}>{fixingResult ? "Done" : "Fix result"}</button></div>
        <div className="result-ingredient-list">
          {reviewItems.map((ingredient, index) => <div className="result-ingredient" key={index}>
            <div className="ingredient-summary">
              <button className="ingredient-main" disabled={!fixingResult} onClick={() => setEditingIndex(editingIndex === index ? null : index)}>
                <strong>{ingredient.name || "New ingredient"}</strong>
                <span>{ingredient.amountGrams ? `${ingredient.amountGrams} g` : "Add grams"} · {ingredient.calories} kcal</span>
                <small><i>C {ingredient.carbs}g</i><i>P {ingredient.protein}g</i><i>F {ingredient.fat}g</i></small>
                {ingredient.nutritionSource && <em className="ingredient-source">Source · {ingredient.nutritionSource}{ingredient.fdcId ? ` · FDC ID ${ingredient.fdcId}` : ""}</em>}
                {ingredient.calculationSource === "usda" && <em className="packaged-food-hint">Packaged product? Select Edit, then “Use package nutrition label” for the exact brand values.</em>}
              </button>
              {fixingResult && <button className="ingredient-edit-trigger" onClick={() => setEditingIndex(editingIndex === index ? null : index)}>{editingIndex === index ? "−" : "Edit"}</button>}
            </div>
            {fixingResult && editingIndex === index && <div className="ingredient-inline-editor">
              <label><span>Food</span><input value={ingredient.name} onChange={event => updateReviewName(index, event.target.value)} placeholder="Food name" /></label>
              <label><span>Grams</span><input type="number" inputMode="numeric" min="1" max="5000" step="1" value={ingredient.amountGrams} onChange={event => updateReviewGrams(index, event.target.value)} placeholder="120" /><small className="gram-unit">g</small></label>
              {savedProducts.length > 0 && <label className="saved-product-picker"><span>Saved packaged product</span><select value="" onChange={event => selectSavedProduct(index, event.target.value)}><option value="">Choose a saved product</option>{(savedProducts as SavedPackagedProduct[]).map(product => <option key={product.id} value={product.id}>{product.productName}</option>)}</select><small>Loads the saved per-100 g label values. You only need to confirm the portion grams.</small></label>}
              <label className="package-label-toggle"><input type="checkbox" checked={Boolean(ingredient.labelNutrition)} onChange={event => togglePackageLabel(index, event.target.checked)} /><span>Use package nutrition label</span></label>
              {ingredient.labelNutrition && <div className="package-label-fields">
                <div className="package-label-heading"><strong>Required values per 100 g</strong><small>Type every figure exactly as printed on the package.</small></div>
                <label className="product-name"><span>Product name</span><input value={ingredient.labelNutrition.productName} onChange={event => updateLabelField(index, "productName", event.target.value)} placeholder="Enter product name" /></label>
                <label><span>Energy</span><input type="number" min="0" step="0.1" inputMode="decimal" value={ingredient.labelNutrition.energyValue} onChange={event => updateLabelField(index, "energyValue", event.target.value)} placeholder="Enter value" /></label>
                <label><span>Unit</span><select value={ingredient.labelNutrition.energyUnit} onChange={event => updateLabelField(index, "energyUnit", event.target.value)}><option value="kJ">kJ</option><option value="kcal">kcal</option></select></label>
                <label><span>Carbs (g)</span><input type="number" min="0" step="0.1" inputMode="decimal" value={ingredient.labelNutrition.carbs} onChange={event => updateLabelField(index, "carbs", event.target.value)} placeholder="Enter value" /></label>
                <label><span>Protein (g)</span><input type="number" min="0" step="0.1" inputMode="decimal" value={ingredient.labelNutrition.protein} onChange={event => updateLabelField(index, "protein", event.target.value)} placeholder="Enter value" /></label>
                <label><span>Fat (g)</span><input type="number" min="0" step="0.1" inputMode="decimal" value={ingredient.labelNutrition.fat} onChange={event => updateLabelField(index, "fat", event.target.value)} placeholder="Enter value" /></label>
                <label><span>Fibre (g)</span><input type="number" min="0" step="0.1" inputMode="decimal" value={ingredient.labelNutrition.fibre} onChange={event => updateLabelField(index, "fibre", event.target.value)} placeholder="Enter value" /></label>
              </div>}
              <button onClick={() => removeReviewItem(index)}>Remove ingredient</button>
            </div>}
          </div>)}
        </div>
        {fixingResult && <>
          <button className="add-ingredient" onClick={addReviewItem}>＋ Add new ingredient</button>
          <details className="hidden-calories"><summary>Oil, butter, sauces <span>Add exact grams</span></summary><p>If one is missing, select “Add new ingredient,” enter its name, then enter the grams used. MealRoute will calculate it with the rest of the confirmed meal.</p></details>
        </>}
        {analysisError && <div className="connection-notice"><b>Couldn’t update estimate</b><span>{analysisError}</span></div>}
        {reviewProblem && <div className="review-validation-hint"><b>Complete the required fields</b><span>{reviewProblem}</span></div>}
        <div className="result-actions">
          {reviewDirty ? <button className="update-result" disabled={analyzing || Boolean(reviewProblem)} onClick={recalculateReview}>{analyzing ? "Recalculating confirmed foods…" : "Update nutrition"}</button> : <><button className="log-result" onClick={() => onAddAnalysis("today")}>Log meal · {analysis.calories.best} kcal</button><button className="plan-result" onClick={() => onAddAnalysis("plan")}>Add to plan</button></>}
        </div>
        <p className="fine-print">Package-label values are calculated exactly from the figures you enter. USDA values remain estimates and can vary by product and preparation. Verify ingredients, allergens and serving sizes. USDA does not endorse MealRoute.</p>
      </div>
    </>}
    {type === "profile" && <><div className="profile-head"><div className="avatar big">{profileInitials(profile?.name)}</div><div><h2>{profile?.name || "Your profile"}</h2><p>{profileGoalLabel(profile?.primary_goal)} · {profile?.weight_unit === "lb" ? "Imperial weight" : "Metric weight"}</p></div></div><div className="modal-list settings"><button onClick={() => next("weight")}><span><strong>Weight progress</strong><small>{weightLogs.length ? `${weightInUnit(weightLogs[weightLogs.length - 1].weight_kg, profile?.weight_unit || "kg").toFixed(1)} ${profile?.weight_unit || "kg"} · ${weightLogs.length} saved ${weightLogs.length === 1 ? "entry" : "entries"}` : "Log weight and review trends"}</small></span><b>›</b></button><button onClick={() => next("goals")}><span><strong>Goals & targets</strong><small>{Number(target || 0).toLocaleString()} kcal daily goal</small></span><b>›</b></button><button onClick={() => next("macros")}><span><strong>Macro targets</strong><small>{macroTargets.protein}g protein · {macroTargets.carbs}g carbs · {macroTargets.fat}g fat</small></span><b>›</b></button><button><span><strong>Dietary preferences</strong><small>No declared allergies</small></span><b>›</b></button><button><span><strong>Notifications</strong><small>All reminders off</small></span><b>›</b></button><button><span><strong>Subscription</strong><small>MealRoute account</small></span><b>›</b></button><button><span><strong>Privacy & your data</strong><small>Export or delete account</small></span><b>›</b></button></div><button className="text-button danger" disabled={loggingOut} onClick={onLogout}>{loggingOut ? "Logging out…" : "Log out"}</button></>}
    {type === "weight" && profile && <WeightProgressEditor profile={profile} logs={weightLogs} onBack={() => next("profile")} onReviewGoals={() => next("goals")} onSave={onSaveWeight} onDelete={onDeleteWeight} />}
    {type === "goals" && profile && <GoalsEditor profile={profile} onBack={() => next("profile")} onSave={onSaveProfileGoals} />}
    {type === "macros" && profile && <MacroTargetsEditor profile={profile} calorieGoal={target} currentTargets={macroTargets} onBack={() => next("profile")} onSave={onSaveProfileMacros} />}
    {type === "manual" && <ManualFoodEditor startMode={manualStartMode} initialFood={manualInitialFood} recentFoods={recentFoods} savedProducts={savedProducts} onAdd={onAddManualFood} />}
    {type === "barcode" && <BarcodeScanner savedProducts={savedProducts} onSaveProduct={(product) => { const next = [...(savedProducts as SavedPackagedProduct[]), product]; onSaveProducts(next.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50)); }} onAdd={onAddManualFood} />}

  </section></div>;
}
