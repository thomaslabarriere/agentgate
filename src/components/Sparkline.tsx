import type { AnalyticsPoint } from "@/lib/gql";

/**
 * A compact allow/deny area sparkline rendered as inline SVG (no chart lib).
 * Two stacked areas: allow (emerald) above deny (rose), normalised to the
 * busiest day so the shape reads at a glance.
 */
export function Sparkline({
  series,
  width = 520,
  height = 72,
}: {
  series: AnalyticsPoint[];
  width?: number;
  height?: number;
}) {
  if (series.length === 0) {
    return null;
  }

  const max = Math.max(1, ...series.map((p) => p.allow + p.deny));
  const stepX = series.length > 1 ? width / (series.length - 1) : 0;
  const y = (v: number) => height - (v / max) * height;

  const pointsFor = (pick: (p: AnalyticsPoint) => number) =>
    series.map((p, i) => `${i * stepX},${y(pick(p))}`).join(" ");

  const allowLine = pointsFor((p) => p.allow + p.deny); // top of stack
  const denyLine = pointsFor((p) => p.deny);

  const areaAllow = `0,${height} ${allowLine} ${(series.length - 1) * stepX},${height}`;
  const areaDeny = `0,${height} ${denyLine} ${(series.length - 1) * stepX},${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-18 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label="Allow and deny decisions over time"
    >
      <polygon points={areaAllow} className="fill-emerald-500/15" />
      <polyline
        points={allowLine}
        className="fill-none stroke-emerald-400/70"
        strokeWidth={1.5}
      />
      <polygon points={areaDeny} className="fill-rose-500/20" />
      <polyline
        points={denyLine}
        className="fill-none stroke-rose-400/70"
        strokeWidth={1.5}
      />
    </svg>
  );
}
