import type { DashboardAnalyticsSeriesPoint } from "../../lib/openstat-api";

export type KpiTone = "neutral" | "success" | "warning" | "danger";

export type DashboardSparklineKey =
  | "activeAgents"
  | "decisions"
  | "errors"
  | "events"
  | "failures"
  | "fills"
  | "orders"
  | "pnlSnapshots"
  | "riskRejects";

export function DashboardKpiCard(props: {
  label: string;
  series?: Array<DashboardAnalyticsSeriesPoint>;
  seriesKey?: DashboardSparklineKey;
  sparklinePoints?: number[];
  value: string;
  href: string;
  tone?: KpiTone;
}) {
  const tone = props.tone ?? "neutral";
  const seriesKey = props.seriesKey;
  const sparklinePoints =
    props.sparklinePoints ??
    (props.series && seriesKey
      ? props.series.map((point) => point[seriesKey] ?? 0)
      : undefined);

  return (
    <a className={`dashboard-kpi dashboard-kpi-${tone}`} href={props.href}>
      <span className="dashboard-kpi-label">{props.label}</span>
      <strong>{props.value}</strong>
      {sparklinePoints ? (
        <DashboardKpiSparkline points={sparklinePoints} tone={tone} />
      ) : null}
    </a>
  );
}

function DashboardKpiSparkline(props: { points: number[]; tone: KpiTone }) {
  const width = 180;
  const height = 28;
  const padding = 2;
  const path = getSparklinePath(props.points, width, height, padding);

  if (!path) {
    return null;
  }

  return (
    <svg
      aria-hidden="true"
      className="dashboard-kpi-sparkline"
      focusable="false"
      preserveAspectRatio="none"
      viewBox={`0 0 ${width} ${height}`}
    >
      <path
        className={`dashboard-kpi-sparkline-line dashboard-kpi-sparkline-${props.tone}`}
        d={path}
      />
    </svg>
  );
}

function getSparklinePath(
  points: number[],
  width: number,
  height: number,
  padding: number,
) {
  if (points.length < 2) {
    return undefined;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(max - min, 1);
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  return points
    .map((point, index) => {
      const x = padding + (index / (points.length - 1)) * innerWidth;
      const y = padding + (1 - (point - min) / span) * innerHeight;

      return `${index === 0 ? "M" : "L"} ${roundPathNumber(x)} ${roundPathNumber(y)}`;
    })
    .join(" ");
}

function roundPathNumber(value: number) {
  return Number(value.toFixed(2));
}
