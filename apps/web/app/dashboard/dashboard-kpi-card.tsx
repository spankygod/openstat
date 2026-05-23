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

type DashboardSparklineSeries = {
  points: number[];
  tone?: KpiTone;
};

type DashboardKpiBadge = {
  label: string;
  tone?: KpiTone;
};

export function DashboardKpiCard(props: {
  badge?: DashboardKpiBadge;
  label: string;
  series?: Array<DashboardAnalyticsSeriesPoint>;
  seriesKey?: DashboardSparklineKey;
  sparklinePoints?: number[];
  sparklineSeries?: DashboardSparklineSeries[];
  value: string;
  href: string;
  tone?: KpiTone;
}) {
  const tone = props.tone ?? "neutral";
  const seriesKey = props.seriesKey;
  const sparklineSeries =
    props.sparklineSeries ??
    getSingleSparklineSeries({
      points: props.sparklinePoints,
      series: props.series,
      seriesKey,
      tone,
    });

  return (
    <a className={`dashboard-kpi dashboard-kpi-${tone}`} href={props.href}>
      <span className="dashboard-kpi-label">{props.label}</span>
      {props.badge ? (
        <span
          className={`dashboard-kpi-badge dashboard-kpi-badge-${props.badge.tone ?? "neutral"}`}
        >
          {props.badge.label}
        </span>
      ) : null}
      <strong>{props.value}</strong>
      {sparklineSeries ? (
        <DashboardKpiSparkline series={sparklineSeries} />
      ) : null}
    </a>
  );
}

function getSingleSparklineSeries(options: {
  points?: number[];
  series?: Array<DashboardAnalyticsSeriesPoint>;
  seriesKey?: DashboardSparklineKey;
  tone: KpiTone;
}) {
  if (options.points) {
    return [{ points: options.points, tone: options.tone }];
  }

  if (!options.series || !options.seriesKey) {
    return undefined;
  }

  const seriesKey = options.seriesKey;
  const points = options.series.map((point) => point[seriesKey] ?? 0);

  return [{ points, tone: options.tone }];
}

function DashboardKpiSparkline(props: { series: DashboardSparklineSeries[] }) {
  const width = 180;
  const height = 32;
  const padding = 4;
  const paths = getSparklinePaths(props.series, width, height, padding);

  if (paths.length === 0) {
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
      {paths.map((path, index) => (
        <path
          className={`dashboard-kpi-sparkline-line dashboard-kpi-sparkline-${path.tone}`}
          d={path.d}
          key={index}
        />
      ))}
    </svg>
  );
}

function getSparklinePaths(
  series: DashboardSparklineSeries[],
  width: number,
  height: number,
  padding: number,
) {
  const drawableSeries = series.filter((item) => item.points.length >= 2);

  if (drawableSeries.length === 0) {
    return [];
  }

  const values = drawableSeries.flatMap((item) => item.points);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  return drawableSeries.map((item) => ({
    d: item.points
      .map((point, index) => {
        const x = padding + (index / (item.points.length - 1)) * innerWidth;
        const y = padding + (1 - (point - min) / span) * innerHeight;

        return `${index === 0 ? "M" : "L"} ${roundPathNumber(x)} ${roundPathNumber(y)}`;
      })
      .join(" "),
    tone: item.tone ?? "neutral",
  }));
}

function roundPathNumber(value: number) {
  return Number(value.toFixed(2));
}
