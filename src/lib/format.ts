/** Pure display formatters shared across the console. No React, no I/O. */

/** Format a 0..1 rate as a whole-number percentage, e.g. 0.8342 -> "83%". */
export function formatRate(rate: number): string {
  if (!Number.isFinite(rate)) return "—";
  const clamped = Math.max(0, Math.min(1, rate));
  return `${Math.round(clamped * 100)}%`;
}

/** Compute an allow rate from counts, guarding division by zero. */
export function allowRate(allow: number, total: number): number {
  if (total <= 0) return 0;
  return allow / total;
}

/** Group-separated integer, e.g. 12045 -> "12,045". */
export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

export interface DayBucket {
  date: string; // YYYY-MM-DD
  allow: number;
  deny: number;
}

/**
 * Bucket decisions by calendar day into allow/deny counts, oldest-first. The
 * analytics resolver returns aggregate totals only, so the dashboard sparkline
 * is derived here from the recent decisions list.
 */
export function seriesFromDecisions(
  decisions: { createdAt: string; granted: boolean }[],
): DayBucket[] {
  const byDay = new Map<string, DayBucket>();
  for (const d of decisions) {
    const day = d.createdAt.slice(0, 10);
    const bucket = byDay.get(day) ?? { date: day, allow: 0, deny: 0 };
    if (d.granted) bucket.allow += 1;
    else bucket.deny += 1;
    byDay.set(day, bucket);
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Compact, readable timestamp, e.g. "Sep 17, 14:03". */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
