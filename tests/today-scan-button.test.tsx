import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { Today } from "../app/components/Today";

// Decision 1 (tester feedback): the Today dashboard's "Scan or log meal" button must open the
// camera directly (a PhotoPicker with capture), NOT the "How would you like to log?" chooser.
// The chooser stays reachable via the "More logging options" link for power users.

function renderToday() {
  return renderToString(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createElement(Today as any, {
      meals: [],
      selectedDate: "",
      onSelectDate: () => {},
      consumed: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      target: 2000,
      macroTargets: { carbs: 200, protein: 120, fat: 60 },
      pct: 0,
      water: 0,
      waterGoal: 2500,
      onMeal: () => {},
      onWater: () => {},
      onLog: () => {},
      onPhoto: () => {},
      onBarcode: () => {},
      micros: undefined,
      notificationPrefs: {},
      onAddIngredient: () => {},
      onEditIngredient: () => {},
      onRemoveIngredient: () => {},
      onDeleteMeal: () => {},
    })
  );
}

describe("Today dashboard scan flow (Decision 1)", () => {
  const html = renderToday();

  it("renders Scan or log meal as a direct camera picker (PhotoPicker with capture)", () => {
    expect(html).toContain("photo-picker");
    expect(html).toContain("scan-meal");
    expect(html).toContain('capture="environment"');
    expect(html).toContain("Scan or log meal");
  });

  it("does not render the scan-meal button as a plain button that opens the chooser", () => {
    // The old markup was <button type="button" class="scan-meal">
    expect(html).not.toMatch(/<button[^>]*class="[^"]*scan-meal/);
  });

  it("keeps the full chooser reachable via the More logging options link", () => {
    expect(html).toContain("More logging options");
  });

  it("keeps the barcode and water buttons as regular buttons", () => {
    expect(html).toMatch(/<button[^>]*class="[^"]*scan-barcode/);
    expect(html).toMatch(/<button[^>]*class="[^"]*log-water/);
  });
});
