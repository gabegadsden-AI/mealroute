import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { Modal } from "../app/components/Modal";
import { localDateKey, dateFromKey } from "../lib/app-utils";

// Tester feedback (backdated logging): when a past date is selected on the Today
// dashboard, every logging surface must make the destination explicit ("Logging to …")
// and offer a one-tap switch back to today, so a backfilled meal never lands on a
// surprise day. When today is selected, no banner is shown at all.

function pastKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateKey(d);
}

function stripComments(html: string) {
  return html.replace(/<!-- -->/g, "");
}

function renderLogModal(props: Record<string, unknown>) {
  return renderToString(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createElement(Modal as any, { type: "log", close: () => {}, onPhoto: () => {}, next: () => {}, onManualSearch: () => {}, ...props })
  );
}

describe("Backdated logging: destination banner", () => {
  const pastDate = pastKey();
  const dateLabel = dateFromKey(pastDate).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
  const backfillNotice = { dateLabel, onSwitchToToday: () => {} };

  it("shows the logging destination and a switch-to-today action on the log chooser when a past date is selected", () => {
    const html = stripComments(renderLogModal({ backfillNotice }));
    expect(html).toContain("backfill-notice");
    expect(html).toContain(`Logging to ${dateLabel}`);
    expect(html).toContain("Switch to today");
  });

  it("shows the destination on the previous-meals quick log surface", () => {
    const html = renderToString(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createElement(Modal as any, { type: "previous", close: () => {}, next: () => {}, previousMeals: [], onLogPrevious: () => {}, backfillNotice })
    );
    expect(stripComments(html)).toContain(`Logging to ${dateLabel}`);
    expect(html).toContain("Switch to today");
  });

  it("shows no banner when the user is on today", () => {
    const html = renderLogModal({ backfillNotice: null });
    expect(html).not.toContain("backfill-notice");
    expect(html).not.toContain("Logging to");
  });

  it("shows the destination on the photo review screen above the log button", () => {
    const analysis = {
      mealName: "Chicken salad",
      confidence: "High",
      calculationMethod: "ai_estimate",
      calories: { best: 450, low: 400, high: 500 },
      protein: 35, carbs: 20, fat: 18, fibre: 5,
      uncertainties: [],
      clarifyingQuestions: [],
      ingredients: [],
    };
    const raw = renderToString(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createElement(Modal as any, {
        type: "result", close: () => {}, analysis, uploadedPhoto: null,
        onAnalyze: () => {}, onAddAnalysis: () => {}, analyzing: false,
        savedProducts: [], reviewDirty: false, backfillNotice,
      })
    );
    const html = stripComments(raw);
    expect(html).toContain(`Logging to ${dateLabel}`);
    expect(html).toContain("Log meal");
  });
});

describe("Backdated logging: date resolution contract", () => {
  it("a past day selected on the Today dashboard is a valid date key with a friendly label", () => {
    const key = pastKey();
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(key < localDateKey()).toBe(true);
    expect(dateFromKey(key).getDate()).toBe(Number(key.slice(-2)));
  });
});
