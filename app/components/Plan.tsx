"use client";
import { useState, useEffect } from "react";
import { localDateKey, dateFromKey, type Meal } from "../../lib/app-utils";
import { type MealSlot, mealSlots, mealSlotLabels, isDateKey, weekStartKey, weekDateKeys, normalizeMealSlot, mealsForWeek, shiftDateKey } from "../../lib/weekly-plan";
import { PlannedMealCard } from "./Today";

export function Plan({ meals, weekStart, onWeekChange, onSchedule, onRemove, onLog, onReviewGrocery, focusDate }: {
  meals: Meal[];
  weekStart: string;
  onWeekChange: (weekStart: string) => void;
  onSchedule: (id: number, plannedDate: string | null, mealSlot?: MealSlot) => Promise<string>;
  onRemove: (id: number) => Promise<void>;
  onLog: (id: number) => Promise<void>;
  onReviewGrocery: (weekStart: string) => Promise<void>;
  focusDate?: string;
}) {
  const activeWeekStart = isDateKey(weekStart) ? weekStart : weekStartKey();
  const dates = weekDateKeys(activeWeekStart);
  const today = localDateKey();
  const [selectedPlanDate, setSelectedPlanDate] = useState(dates.includes(today) ? today : dates[0]);

  useEffect(() => {
    const nextDates = weekDateKeys(activeWeekStart);
    setSelectedPlanDate(nextDates.includes(today) ? today : nextDates[0]);
  }, [activeWeekStart, today]);

  // Jump to the focus date when parent signals a newly scheduled meal
  useEffect(() => {
    if (focusDate && isDateKey(focusDate)) {
      const dates = weekDateKeys(activeWeekStart);
      if (dates.includes(focusDate)) {
        setSelectedPlanDate(focusDate);
      }
    }
  }, [focusDate, activeWeekStart]);

  const weekMeals = mealsForWeek(meals, activeWeekStart);
  const unscheduled = meals.filter(meal => !isDateKey(meal.plannedDate) || !normalizeMealSlot(meal.mealSlot));
  const selectedMeals = weekMeals.filter(meal => meal.plannedDate === selectedPlanDate);
  const plannedCalories = weekMeals.reduce((sum, meal) => sum + meal.calories, 0);
  const weekEnd = dates[6];
  const weekLabel = `${dateFromKey(activeWeekStart).toLocaleDateString([], { day: "numeric", month: "short" })}–${dateFromKey(weekEnd).toLocaleDateString([], { day: "numeric", month: "short" })}`;

  function changeWeek(nextStart: string) {
    onWeekChange(nextStart);
    const nextDates = weekDateKeys(nextStart);
    setSelectedPlanDate(nextDates.includes(today) ? today : nextDates[0]);
  }

  return <>
    <section className="plan-summary weekly-plan-summary"><div><p className="eyebrow">WEEKLY MEAL PLAN</p><h2>{weekMeals.length} {weekMeals.length === 1 ? "meal" : "meals"} · {plannedCalories.toLocaleString()} kcal</h2><p>{weekLabel}. Planned calories remain separate from food already eaten.</p></div><span>{unscheduled.length} unscheduled</span></section>

    <div className="week-navigation"><button type="button" aria-label="Previous week" onClick={() => changeWeek(shiftDateKey(activeWeekStart, -7))}>‹</button><div><strong>{weekLabel}</strong><button type="button" onClick={() => changeWeek(weekStartKey(today))}>This week</button></div><button type="button" aria-label="Next week" onClick={() => changeWeek(shiftDateKey(activeWeekStart, 7))}>›</button></div>

    <div className="week-date-strip">{dates.map(date => {
      const count = weekMeals.filter(meal => meal.plannedDate === date).length;
      const active = date === selectedPlanDate;
      return <button type="button" key={date} className={active ? "active" : ""} onClick={() => setSelectedPlanDate(date)}><span>{dateFromKey(date).toLocaleDateString([], { weekday: "short" }).slice(0, 2)}</span><strong>{dateFromKey(date).getDate()}</strong><small>{count || ""}</small></button>;
    })}</div>

    <section className="weekly-day-plan"><div className="section-heading"><div><p className="eyebrow">SELECTED DAY</p><h2>{dateFromKey(selectedPlanDate).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}</h2></div><span>{selectedMeals.reduce((sum, meal) => sum + meal.calories, 0).toLocaleString()} kcal</span></div>
      {mealSlots.map(slot => {
        const slotMeals = selectedMeals.filter(meal => meal.mealSlot === slot);
        return <div className="meal-slot" key={slot}><div className="meal-slot-heading"><strong>{mealSlotLabels[slot]}</strong><span>{slotMeals.length ? `${slotMeals.length} ${slotMeals.length === 1 ? "meal" : "meals"}` : "Empty"}</span></div>{slotMeals.length ? slotMeals.map(meal => <PlannedMealCard key={meal.id} meal={meal} defaultDate={selectedPlanDate} onSchedule={onSchedule} onRemove={onRemove} onLog={onLog} highlight={!!focusDate && meal.plannedDate === focusDate} />) : <p>No {mealSlotLabels[slot].toLowerCase()} planned.</p>}</div>;
      })}
    </section>

    <section className="unscheduled-plan"><div className="section-heading"><div><p className="eyebrow">READY TO SCHEDULE</p><h2>Unscheduled meals</h2></div><span>{unscheduled.length}</span></div>{unscheduled.length ? <div className="weekly-unscheduled-list">{unscheduled.map(meal => <PlannedMealCard key={meal.id} meal={meal} defaultDate={selectedPlanDate} onSchedule={onSchedule} onRemove={onRemove} onLog={onLog} />)}</div> : <div className="history-empty"><strong>All planned meals are scheduled.</strong><span>Add another meal from Log Food when you are ready.</span></div>}</section>

    {meals.length === 0 && <div className="history-empty"><strong>No meals in your plan yet.</strong><span>Analyze or manually enter a meal, then select Add to plan.</span></div>}
    <button className="wide-button" onClick={() => void onReviewGrocery(activeWeekStart)}>Review this week’s grocery list <span>→</span></button>
  </>;
}

