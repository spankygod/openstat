import { useId } from "react";
import type { ReactNode } from "react";

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

export type DashboardKpiMonitorTone = "good" | "watch" | "bad";

type DashboardKpiMonitorBar = {
  tone: DashboardKpiMonitorTone;
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
  monitorBars?: DashboardKpiMonitorBar[];
  monitorLabel?: string;
  value: ReactNode;
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
      <span className="dashboard-kpi-value-row">
        <strong>{props.value}</strong>
        {props.badge ? (
          <span
            className={`dashboard-kpi-badge dashboard-kpi-badge-${props.badge.tone ?? "neutral"}`}
          >
            {props.badge.label}
          </span>
        ) : null}
      </span>
      {props.monitorBars ? (
        <DashboardKpiMonitorBars
          bars={props.monitorBars}
          label={props.monitorLabel ?? `${props.label} monitor`}
        />
      ) : sparklineSeries ? (
        <DashboardKpiSparkline series={sparklineSeries} tone={tone} />
      ) : null}
    </a>
  );
}

function DashboardKpiMonitorBars(props: {
  bars: DashboardKpiMonitorBar[];
  label: string;
}) {
  return (
    <span
      aria-label={props.label}
      className="dashboard-kpi-monitor-bars"
      role="img"
    >
      {props.bars.map((bar, index) => (
        <span
          className={`dashboard-kpi-monitor-bar dashboard-kpi-monitor-${bar.tone}`}
          key={index}
        />
      ))}
    </span>
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

function DashboardKpiSparkline(props: {
  series: DashboardSparklineSeries[];
  tone: KpiTone;
}) {
  const gradientBaseId = useId().replaceAll(":", "");
  const width = 180;
  const height = 60;
  const paths = getSparklinePaths(props.series, width, height);

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
        <g
          className={`dashboard-kpi-sparkline-series dashboard-kpi-sparkline-${
            props.series.length > 1 ? path.tone : props.tone
          }`}
          key={index}
        >
          <defs>
            <linearGradient
              id={`${gradientBaseId}-${index}`}
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path
            className="dashboard-kpi-sparkline-area"
            d={path.areaD}
            fill={`url(#${gradientBaseId}-${index})`}
          />
          <path className="dashboard-kpi-sparkline-line" d={path.lineD} />
        </g>
      ))}
    </svg>
  );
}

function getSparklinePaths(
  series: DashboardSparklineSeries[],
  width: number,
  height: number,
) {
  const drawableSeries = series.filter((item) => item.points.length >= 2);

  if (drawableSeries.length === 0) {
    return [];
  }

  const values = drawableSeries.flatMap((item) => item.points);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const topPadding = 6;
  const chartBottom = height - 4;
  const innerHeight = 32;
  const startY = topPadding + innerHeight / 2;

  return drawableSeries.map((item) => {
    const points = item.points.map((point, index) => ({
      x: (index / (item.points.length - 1)) * width,
      y:
        span === 0
          ? startY
          : topPadding + (1 - (point - min) / span) * innerHeight,
    }));
    const lineD = getSmoothPath(points);
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];

    return {
      areaD:
        firstPoint && lastPoint
          ? `${lineD} L ${roundPathNumber(lastPoint.x)} ${chartBottom} L ${roundPathNumber(firstPoint.x)} ${chartBottom} Z`
          : "",
      lineD,
      tone: item.tone ?? "neutral",
    };
  });
}

function getSmoothPath(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => {
      if (index === 0) {
        return `M ${roundPathNumber(point.x)} ${roundPathNumber(point.y)}`;
      }

      const previous = points[index - 1] ?? point;
      const controlDistance = (point.x - previous.x) / 2;
      const controlPointOne = {
        x: previous.x + controlDistance,
        y: previous.y,
      };
      const controlPointTwo = {
        x: point.x - controlDistance,
        y: point.y,
      };

      return `C ${roundPathNumber(controlPointOne.x)} ${roundPathNumber(controlPointOne.y)} ${roundPathNumber(controlPointTwo.x)} ${roundPathNumber(controlPointTwo.y)} ${roundPathNumber(point.x)} ${roundPathNumber(point.y)}`;
    })
    .join(" ");
}

function roundPathNumber(value: number) {
  return Number(value.toFixed(2));
}
