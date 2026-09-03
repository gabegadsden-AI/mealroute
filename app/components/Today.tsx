"use client";
import { useEffect, useState } from "react";
import { localDateKey, dateFromKey, type Meal } from "../../lib/app-utils";
import { type MealSlot, mealSlots, mealSlotLabels } from "../../lib/weekly-plan";
import { type Micronutrients, MICRONUTRIENT_LABELS, MICRONUTRIENT_UNITS, MICRONUTRIENT_DV, MICRONUTRIENT_KEYS, hasMicronutrientData } from "../../lib/micronutrients";

const TOP_MICROS: (keyof Micronutrients)[] = ["calcium", "iron", "vitaminC", "vitaminD", "potassium", "sodium"];

export function Today({ meals, selectedDate, onSelectDate, consumed, protein, carbs, fat, target, macroTargets, pct, water, waterGoal, onMeal, onWater, onLog, onBarcode, micros, notificationPrefs }: any) {
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => setToday(new Date()), []);
  const dates = today ? Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index - 6);
    return date;
  }) : [];
  const selectedLabel = selectedDate
    ? selectedDate === (today ? localDateKey(today) : "") ? "Today's meals" : `${dateFromKey(selectedDate).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" })} meals`
    : "Today's meals";
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<{ y: number; m: number } | null>(null);
  useEffect(() => {
    if (today && !calendarMonth) {
      const base = selectedDate ? dateFromKey(selectedDate) : today;
      setCalendarMonth({ y: base.getFullYear(), m: base.getMonth() });
    }
  }, [today, selectedDate, calendarMonth]);

  const showMicros = hasMicronutrientData(micros as Micronutrients | undefined);
  const hour = today ? today.getHours() : 0;
  const isToday = !selectedDate || (today ? selectedDate === localDateKey(today) : false);
  const prefs = (notificationPrefs || {}) as { meals?: boolean; water?: boolean };
  const mealNudge = isToday && Boolean(prefs.meals) && hour >= 12 && (!meals || meals.length === 0);
  const waterNudge = isToday && Boolean(prefs.water) && hour >= 12 && waterGoal > 0 && water < waterGoal;
  return <>
    {(mealNudge || waterNudge) && <section className="today-nudges">
      {mealNudge && <div className="nudge-chip"><b>🍽</b><span>You haven't logged any meals yet today. <button onClick={() => onLog()}>Log your first meal</button></span></div>}
      {waterNudge && <div className="nudge-chip"><b>💧</b><span>Hydration check — {(waterGoal - water).toLocaleString()} ml to go. <button onClick={() => onWater()}>Log water</button></span></div>}
    </section>}
    <section className="daily-overview">
      <div className="date-strip-header">
        <button type="button" className="calendar-toggle" onClick={() => setCalendarOpen(open => !open)} aria-label="Open calendar">📅 {today ? today.toLocaleDateString([], { month: "short", year: "numeric" }) : ""}</button>
      </div>
      {calendarOpen && calendarMonth && <MonthCalendar
        year={calendarMonth.y}
        month={calendarMonth.m}
        selectedDate={selectedDate}
        todayKey={today ? localDateKey(today) : ""}
        onPrevMonth={() => setCalendarMonth(cur => cur ? (cur.m === 0 ? { y: cur.y - 1, m: 11 } : { y: cur.y, m: cur.m - 1 }) : cur)}
        onNextMonth={() => setCalendarMonth(cur => cur ? (cur.m === 11 ? { y: cur.y + 1, m: 0 } : { y: cur.y, m: cur.m + 1 }) : cur)}
        onToday={() => { if (today) { setCalendarMonth({ y: today.getFullYear(), m: today.getMonth() }); onSelectDate(localDateKey(today)); } }}
        onSelect={(key: string) => { onSelectDate(key); setCalendarOpen(false); }}
      />}
      <div className="today-date-strip">
        {dates.length === 0 && Array.from({ length: 7 }, (_, index) => <button key={index} disabled><span>--</span><strong>--</strong></button>)}
        {dates.map(date => {
          const dateKey = localDateKey(date);
          const active = dateKey === selectedDate;
          return <button type="button" key={dateKey} className={active ? "active" : ""} onClick={() => onSelectDate(dateKey)}><span>{date.toLocaleDateString([], { weekday: "short" }).slice(0, 2)}</span><strong>{date.getDate()}</strong>{active && <i />}</button>;
        })}
      </div>
      <div className="calorie-readout">
        <div><strong>{consumed.toLocaleString()}</strong><span>/ {target.toLocaleString()}</span></div>
        <small>CALORIES EATEN</small>
        <p>{Math.max(0, target - consumed).toLocaleString()} kcal left today</p>
        <i><b style={{ width: `${pct}%` }} /></i>
      </div>
      <div className="daily-macro-grid">
        <MacroGoal kind="carbs" label="Carbs" value={carbs} goal={macroTargets.carbs} />
        <MacroGoal kind="protein" label="Protein" value={protein} goal={macroTargets.protein} />
        <MacroGoal kind="fat" label="Fat" value={fat} goal={macroTargets.fat} />
      </div>
      {showMicros && <MicronutrientGrid micros={micros} />}
      <div className="overview-actions">
        <button type="button" className="scan-meal" onClick={onLog}>
          <span aria-hidden>+</span><b>Scan or log meal</b>
        </button>
        <button type="button" className="scan-barcode" onClick={onBarcode}>
          <svg aria-hidden width="16" height="14" viewBox="0 0 16 14" fill="none"><rect x="0" y="0" width="1.4" height="14" fill="currentColor" /><rect x="2.6" y="0" width="0.9" height="14" fill="currentColor" /><rect x="4.7" y="0" width="1.8" height="14" fill="currentColor" /><rect x="7.7" y="0" width="0.9" height="14" fill="currentColor" /><rect x="9.6" y="0" width="1.4" height="14" fill="currentColor" /><rect x="11.8" y="0" width="0.9" height="14" fill="currentColor" /><rect x="13.5" y="0" width="1.8" height="14" fill="currentColor" /></svg>
          <b>Scan barcode</b>
        </button>
        <button type="button" className="log-water" onClick={onWater} aria-label={`Water: ${water} of ${waterGoal} millilitres`}>
          <span aria-hidden>♢</span><b>{(water / 1000).toFixed(1)} / {(waterGoal / 1000).toFixed(1)}L</b>
        </button>
      </div>
    </section>

    <section className="section-block">
      <div className="section-heading history-heading"><div><p className="eyebrow">MEAL HISTORY</p><h2>{selectedLabel}</h2></div><input className="history-date-picker" aria-label="Choose meal history date" type="date" value={selectedDate} max={today ? localDateKey(today) : undefined} onChange={event => { if (event.target.value) onSelectDate(event.target.value); }} /></div>
      {meals.length > 0
        ? <><span className="history-count">{meals.filter((m: Meal) => m.eaten).length} of {meals.length} complete</span><div className="meal-list">{meals.map((meal: Meal) => <MealCard key={meal.id} meal={meal} onMeal={onMeal} />)}</div></>
        : <div className="history-empty"><strong>No meals logged for this date.</strong><span>Select another day or log a meal for today.</span><button onClick={onLog}>Log today's meal</button></div>}
    </section>

    <section className="insight-card"><div className="spark">✦</div><div><p className="eyebrow">TODAY'S INSIGHT</p><strong>You have {Math.max(0, Math.round(macroTargets.protein - protein))}g of protein remaining.</strong><p>Your planned meals can help close the gap.</p></div></section>
  </>;
}

function MonthCalendar({ year, month, selectedDate, todayKey, onPrevMonth, onNextMonth, onToday, onSelect }: {
  year: number; month: number; selectedDate: string; todayKey: string;
  onPrevMonth: () => void; onNextMonth: () => void; onToday: () => void; onSelect: (key: string) => void;
}) {
  const monthLabel = new Date(year, month, 1).toLocaleDateString([], { month: "long" });
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // Monday-first grid
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array.from({ length: startOffset }, () => null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return <div className="month-calendar">
    <div className="month-calendar-head">
      <strong>{monthLabel} <span>{year}</span></strong>
      <div className="month-calendar-nav">
        <button type="button" onClick={onPrevMonth} aria-label="Previous month">‹</button>
        <button type="button" className="month-calendar-today" onClick={onToday}>Today</button>
        <button type="button" onClick={onNextMonth} aria-label="Next month">›</button>
      </div>
    </div>
    <div className="month-calendar-weekdays">{["M", "T", "W", "T", "F", "S", "S"].map((d, index) => <span key={index}>{d}</span>)}</div>
    <div className="month-calendar-grid">
      {cells.map((day, index) => {
        if (day === null) return <i key={index} />;
        const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const isToday = key === todayKey;
        const isSelected = key === selectedDate;
        return <button type="button" key={index} className={isSelected ? "selected" : isToday ? "is-today" : ""} onClick={() => onSelect(key)}>{day}</button>;
      })}
    </div>
  </div>;
}

function MicronutrientGrid({ micros }: { micros: Micronutrients }) {
  return <div className="micro-grid">
    {TOP_MICROS.map(key => {
      const value = micros[key] || 0;
      const dv = MICRONUTRIENT_DV[key];
      const pct = dv > 0 ? Math.min(100, Math.round((value / dv) * 100)) : 0;
      return <div className="micro-tile" key={key}>
        <span>{MICRONUTRIENT_LABELS[key]}</span>
        <i><b style={{ width: `${pct}%` }} /></i>
        <strong>{value < 1 ? value.toFixed(1) : Math.round(value)}<small>{MICRONUTRIENT_UNITS[key]}</small></strong>
      </div>;
    })}
  </div>;
}

export function MacroGoal({ kind, label, value, goal }: { kind: string; label: string; value: number; goal: number }) {
  return <div className={`macro-goal ${kind}`}><span>{label}</span><i><b style={{ width: `${goal > 0 ? Math.min(100, Math.round(value / goal * 100)) : 0}%` }} /></i><strong>{value}<small> / {goal}g</small></strong></div>;
}

export function MealCard({ meal, onMeal }: { meal: Meal; onMeal: (id: number) => void }) {
  return <article className={`meal-card ${meal.eaten ? "done" : ""}`}>
    <div className={`meal-image ${meal.color}`}><span>{meal.type === "Breakfast" ? "◒" : meal.type === "Lunch" ? "◐" : meal.type === "Dinner" ? "◑" : "●"}</span></div>
    <div className="meal-info"><div><span>{meal.type} · {meal.time}</span>{meal.locked && <em>Locked</em>}</div><h3>{meal.name}</h3><p>{meal.calories} kcal <b>·</b> {meal.protein}g protein</p></div>
    <button className={meal.eaten ? "check checked" : "check"} onClick={() => onMeal(meal.id)} aria-label={`Mark ${meal.name} ${meal.eaten ? "not eaten" : "eaten"}`}>{meal.eaten ? "✓" : ""}</button>
  </article>;
}

export function PlannedMealCard({ meal, defaultDate, onSchedule, onRemove, onLog, highlight }: {
  meal: Meal;
  defaultDate: string;
  onSchedule: (id: number, plannedDate: string | null, mealSlot?: MealSlot) => Promise<string>;
  onRemove: (id: number) => Promise<void>;
  onLog: (id: number) => Promise<void>;
  highlight?: boolean;
}) {
  const [editing, setEditing] = useState(!meal.plannedDate || !meal.mealSlot);
  const [date, setDate] = useState(meal.plannedDate || defaultDate);
  const [slot, setSlot] = useState<MealSlot>(meal.mealSlot || "breakfast");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDate(meal.plannedDate || defaultDate);
    setSlot(meal.mealSlot || "breakfast");
  }, [meal.plannedDate, meal.mealSlot, defaultDate]);

  async function saveSchedule() {
    if (saving) return;
    setSaving(true);
    setError("");
    const saveError = await onSchedule(meal.id, date, slot);
    setSaving(false);
    if (saveError) {
      setError(saveError);
      return;
    }
    setEditing(false);
  }

  async function logToday() {
    if (saving) return;
    setSaving(true);
    await onLog(meal.id);
    setSaving(false);
  }

  return <article className={`weekly-plan-meal${highlight ? " just-added" : ""}`}>
    <div className="weekly-plan-meal-head"><div className={`meal-image ${meal.color}`}><span>{meal.mealSlot ? mealSlotLabels[meal.mealSlot].slice(0, 1) : "●"}</span></div><div><span>{meal.mealSlot ? mealSlotLabels[meal.mealSlot] : "Unscheduled"}</span><h3>{meal.name}</h3><p>{meal.calories} kcal · {meal.protein}g protein</p></div></div>
    {editing && <div className="plan-schedule-editor">
      <label><span>Date</span><input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
      <label><span>Meal</span><select value={slot} onChange={event => setSlot(event.target.value as MealSlot)}>{mealSlots.map(value => <option key={value} value={value}>{mealSlotLabels[value]}</option>)}</select></label>
      <button type="button" disabled={saving || !date} onClick={() => void saveSchedule()}>{saving ? "Saving…" : "Save schedule"}</button>
      {meal.plannedDate && <button className="plan-unschedule" type="button" disabled={saving} onClick={() => void onSchedule(meal.id, null)}>Move to Unscheduled</button>}
    </div>}
    {error && <div className="plan-card-error" role="alert">{error}</div>}
    <div className="weekly-plan-actions">
      <button type="button" onClick={() => setEditing(value => !value)}>{editing ? "Close editor" : "Move"}</button>
      <button type="button" disabled={saving} onClick={() => void logToday()}>Log as eaten today</button>
      <button className="remove" type="button" disabled={saving} onClick={() => { if (window.confirm(`Remove ${meal.name} from My Plan?`)) void onRemove(meal.id); }}>Remove</button>
    </div>
  </article>;
}
