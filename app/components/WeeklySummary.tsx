"use client";
import { useEffect, useState } from "react";
import { localDateKey, weekRangeLabel, type MealHistory } from "../../lib/app-utils";
import { type Micronutrients, MICRONUTRIENT_KEYS, MICRONUTRIENT_LABELS, MICRONUTRIENT_UNITS, EMPTY_MICRONUTRIENTS } from "../../lib/micronutrients";
import { weekStartKey, shiftDateKey } from "../../lib/weekly-plan";
import { type MealRouteProfile } from "../../lib/profile";

type DaySummary = {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealsLogged: number;
  waterMl: number;
};

type WeeklySummaryData = {
  weekStart: string;
  weekEnd: string;
  days: DaySummary[];
  averages: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    mealsLogged: number;
    waterMl: number;
  };
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    mealsLogged: number;
    waterMl: number;
  };
  weightChange: number | null;
  startWeight: number | null;
  endWeight: number | null;
  daysTracked: number;
  goalCalories: number;
  goalHitDays: number;
};

function formatDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function WeeklySummary({ profile }: { profile: MealRouteProfile | null }) {
  const [summary, setSummary] = useState<WeeklySummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(weekStartKey(localDateKey()));
  const [emailInput, setEmailInput] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    loadSummary(weekStart);
  }, [weekStart]);

  async function loadSummary(ws: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/weekly-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: ws }),
      });
      const data = await res.json();
      if (data.error) {
        setSummary(null);
      } else {
        setSummary(data.summary);
      }
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  async function sendEmail() {
    if (!emailInput.trim() || !emailInput.includes("@")) {
      setEmailStatus("Enter a valid email address.");
      return;
    }
    setSharing(true);
    setEmailStatus("");
    try {
      const res = await fetch("/api/weekly-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart, sendEmail: true, email: emailInput.trim() }),
      });
      const data = await res.json();
      if (data.emailSent) {
        setEmailStatus("✅ Summary sent to your email!");
      } else if (data.html) {
        // No email service configured — open printable view
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(data.html);
          printWindow.document.close();
          setEmailStatus("Opened printable summary (email service not configured).");
        } else {
          setEmailStatus("Could not open preview. Check popup blocker.");
        }
      } else {
        setEmailStatus(data.message || "Could not send email.");
      }
    } catch {
      setEmailStatus("Something went wrong. Try the Print option instead.");
    } finally {
      setSharing(false);
    }
  }

  function printSummary() {
    if (!summary) return;
    const html = renderPrintable(summary, profile?.name || "there");
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  }

  function shiftWeek(direction: number) {
    setWeekStart(shiftDateKey(weekStart, direction * 7));
  }

  if (loading) {
    return (
      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">WEEKLY SUMMARY</p>
            <h2>Loading your week…</h2>
          </div>
        </div>
        <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
          Crunching the numbers 🔢
        </div>
      </section>
    );
  }

  if (!summary) {
    return (
      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">WEEKLY SUMMARY</p>
            <h2>No data yet</h2>
          </div>
        </div>
        <div style={{ padding: "20px", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
          Log some meals this week and your summary will appear here.
        </div>
      </section>
    );
  }

  const avg = summary.averages;

  return (
    <section className="section-block">
      <div className="section-heading">
        <div>
          <p className="eyebrow">WEEKLY SUMMARY</p>
          <h2>{formatDate(summary.weekStart)} – {formatDate(summary.weekEnd)}</h2>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => shiftWeek(-1)} title="Previous week">‹</button>
          <button onClick={() => shiftWeek(1)} title="Next week">›</button>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="stats-grid">
        <div>
          <span>Avg calories</span>
          <strong>{avg.calories.toLocaleString()}</strong>
          <small>{summary.daysTracked} days tracked</small>
        </div>
        <div>
          <span>Avg protein</span>
          <strong>{avg.protein}g</strong>
          <small>{summary.totals.mealsLogged} meals logged</small>
        </div>
        <div>
          <span>Avg water</span>
          <strong>{avg.waterMl}ml</strong>
          <small>per day</small>
        </div>
        <div>
          <span>Goal hits</span>
          <strong>{summary.goalHitDays}/{summary.daysTracked}</strong>
          <small>within 15% of target</small>
        </div>
      </div>

      {/* Weight change */}
      {summary.weightChange !== null && (
        <div className="weekly-win" style={{ marginTop: "12px" }}>
          <div className="spark">⚖</div>
          <div>
            <p className="eyebrow">WEIGHT CHANGE</p>
            <h2>{summary.startWeight}kg → {summary.endWeight}kg</h2>
            <p>{summary.weightChange > 0 ? "+" : ""}{summary.weightChange}kg this week</p>
          </div>
        </div>
      )}

      {/* Day-by-day table */}
      <div style={{ overflowX: "auto", marginTop: "16px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <th style={{ textAlign: "left", padding: "8px 6px", color: "var(--muted)", fontWeight: 600 }}>Day</th>
              <th style={{ textAlign: "right", padding: "8px 6px", color: "var(--muted)", fontWeight: 600 }}>Kcal</th>
              <th style={{ textAlign: "right", padding: "8px 6px", color: "var(--muted)", fontWeight: 600 }}>Protein</th>
              <th style={{ textAlign: "right", padding: "8px 6px", color: "var(--muted)", fontWeight: 600 }}>Carbs</th>
              <th style={{ textAlign: "right", padding: "8px 6px", color: "var(--muted)", fontWeight: 600 }}>Fat</th>
              <th style={{ textAlign: "right", padding: "8px 6px", color: "var(--muted)", fontWeight: 600 }}>Water</th>
            </tr>
          </thead>
          <tbody>
            {summary.days.map((d) => {
              const isToday = d.date === localDateKey();
              return (
                <tr key={d.date} style={{ borderBottom: "1px solid var(--line)", background: isToday ? "rgba(169,244,122,0.05)" : "transparent" }}>
                  <td style={{ padding: "8px 6px", fontWeight: isToday ? 700 : 400 }}>{formatDate(d.date)}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>{d.calories || "–"}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>{d.protein ? `${d.protein}g` : "–"}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>{d.carbs ? `${d.carbs}g` : "–"}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>{d.fat ? `${d.fat}g` : "–"}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>{d.waterMl ? `${d.waterMl}ml` : "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "8px", marginTop: "16px", flexWrap: "wrap" }}>
        <button className="primary" onClick={printSummary} style={{ flex: "1", minWidth: "120px", fontSize: "11px", padding: "10px" }}>
          📄 Print / PDF
        </button>
      </div>

      {/* Email section */}
      <div style={{ marginTop: "14px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="email"
          placeholder="Email me this summary"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          style={{
            flex: "1",
            minWidth: "180px",
            padding: "10px 12px",
            borderRadius: "12px",
            border: "1px solid var(--line)",
            background: "var(--panel)",
            color: "var(--text)",
            fontSize: "12px",
            outline: "none",
          }}
        />
        <button
          onClick={sendEmail}
          disabled={sharing}
          style={{
            padding: "10px 16px",
            borderRadius: "12px",
            border: "1px solid var(--green)",
            background: "transparent",
            color: "var(--green)",
            fontSize: "11px",
            fontWeight: 700,
            opacity: sharing ? 0.6 : 1,
          }}
        >
          {sharing ? "Sending…" : "Send"}
        </button>
      </div>
      {emailStatus && (
        <p style={{ fontSize: "10px", color: "var(--muted)", marginTop: "8px" }}>{emailStatus}</p>
      )}
    </section>
  );
}

function renderPrintable(summary: WeeklySummaryData, userName: string): string {
  const avg = summary.averages;
  const goalText = summary.goalCalories > 0
    ? `Goal: ${summary.goalCalories} kcal · Hit ${summary.goalHitDays}/${summary.daysTracked} days`
    : "";
  const dayRows = summary.days.map(d => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;">${formatDate(d.date)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${d.calories || "–"}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${d.protein || "–"}g</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${d.carbs || "–"}g</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${d.fat || "–"}g</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${d.waterMl || "–"}ml</td>
    </tr>`).join("");

  const weightRow = summary.weightChange !== null
    ? `<p style="margin:12px 0 0;color:#666;">Weight: ${summary.startWeight}kg → ${summary.endWeight}kg (${summary.weightChange > 0 ? "+" : ""}${summary.weightChange}kg)</p>`
    : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>MealRoute Weekly Summary</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <div style="background:#f0fdf4;border-radius:12px;padding:24px;margin-bottom:20px;">
    <h1 style="margin:0 0 4px;font-size:24px;color:#15803d;">📊 Your Weekly Summary</h1>
    <p style="margin:0;color:#666;">${formatDate(summary.weekStart)} – ${formatDate(summary.weekEnd)}</p>
  </div>
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;">
    <div style="flex:1;min-width:120px;background:#f9fafb;border-radius:8px;padding:16px;text-align:center;">
      <div style="font-size:28px;font-weight:700;color:#15803d;">${avg.calories}</div>
      <div style="font-size:12px;color:#666;">Avg kcal/day</div>
    </div>
    <div style="flex:1;min-width:120px;background:#f9fafb;border-radius:8px;padding:16px;text-align:center;">
      <div style="font-size:28px;font-weight:700;color:#15803d;">${avg.protein}g</div>
      <div style="font-size:12px;color:#666;">Avg protein/day</div>
    </div>
    <div style="flex:1;min-width:120px;background:#f9fafb;border-radius:8px;padding:16px;text-align:center;">
      <div style="font-size:28px;font-weight:700;color:#15803d;">${avg.waterMl}ml</div>
      <div style="font-size:12px;color:#666;">Avg water/day</div>
    </div>
  </div>
  ${goalText ? `<p style="margin:0 0 16px;color:#666;">${goalText}</p>` : ""}
  ${weightRow}
  <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px;">
    <thead><tr style="background:#f0fdf4;">
      <th style="padding:8px;text-align:left;border-bottom:2px solid #ccc;">Day</th>
      <th style="padding:8px;text-align:right;border-bottom:2px solid #ccc;">Kcal</th>
      <th style="padding:8px;text-align:right;border-bottom:2px solid #ccc;">Protein</th>
      <th style="padding:8px;text-align:right;border-bottom:2px solid #ccc;">Carbs</th>
      <th style="padding:8px;text-align:right;border-bottom:2px solid #ccc;">Fat</th>
      <th style="padding:8px;text-align:right;border-bottom:2px solid #ccc;">Water</th>
    </tr></thead>
    <tbody>${dayRows}</tbody>
  </table>
  <p style="margin-top:24px;font-size:13px;color:#999;">Days tracked: ${summary.daysTracked}/7 · Meals logged: ${summary.totals.mealsLogged}</p>
  <p style="margin-top:8px;font-size:13px;color:#999;">Generated by MealRoute 🥗</p>
</body></html>`;
}
