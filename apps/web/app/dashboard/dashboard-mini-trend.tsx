"use client";

import { useState } from "react";

import type {
  DashboardAnalyticsSeriesPoint,
  DashboardRange,
} from "../../lib/openstat-api";

export function DashboardMiniTrend(props: {
  points: Array<DashboardAnalyticsSeriesPoint>;
  range: DashboardRange;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const rawMax = Math.max(
    ...props.points.map((point) => Math.max(point.events, point.errors)),
    1,
  );
  const yAxisTicks = getChartTicks(rawMax);
  const max = yAxisTicks[0] ?? rawMax;
  const xAxisLabelIndexes = getChartLabelIndexes(
    props.points.length,
    props.range,
  );
  const hasErrors = props.points.some((point) => point.errors > 0);

  if (props.points.length === 0) {
    return (
      <div className="dashboard-chart-empty">
        <p>No event series for this range yet.</p>
      </div>
    );
  }

  return (
    <div
      className="dashboard-chart"
      data-has-errors={hasErrors ? "true" : "false"}
      aria-label="Events and errors over time"
    >
      <div className="dashboard-chart-y-axis" aria-hidden="true">
        {yAxisTicks.map((tick) => (
          <span key={tick}>{formatNumber(tick)}</span>
        ))}
      </div>
      <div className="dashboard-chart-plot">
        <div className="dashboard-chart-grid" aria-hidden="true" />
        <div className="dashboard-chart-bars">
          {props.points.map((point, index) => (
            <div
              aria-label={`${formatChartTooltipDate(point.bucket, props.range)}: ${formatNumber(point.events)} events, ${formatNumber(point.errors)} errors`}
              className="dashboard-chart-bucket"
              data-active={activeIndex === index ? "true" : undefined}
              key={point.bucket}
              onBlur={() => setActiveIndex(null)}
              onClick={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onPointerEnter={() => setActiveIndex(index)}
              onPointerLeave={() => setActiveIndex(null)}
              role="group"
              tabIndex={0}
            >
              <span className="dashboard-chart-guide" aria-hidden="true" />
              <span
                className="dashboard-chart-bar dashboard-chart-events"
                data-empty={point.events > 0 ? undefined : "true"}
                style={{
                  height:
                    point.events > 0
                      ? `${Math.max((point.events / max) * 100, 4)}%`
                      : "0%",
                }}
              />
              <span
                className="dashboard-chart-bar dashboard-chart-errors"
                data-empty={point.errors > 0 ? undefined : "true"}
                style={{
                  height:
                    point.errors > 0
                      ? `${Math.max((point.errors / max) * 100, 2)}%`
                      : "0%",
                }}
              />
              <span className="dashboard-chart-tooltip" role="tooltip">
                <strong>
                  {formatChartTooltipDate(point.bucket, props.range)}
                </strong>
                <span>
                  <i className="dashboard-legend-events" />
                  {formatNumber(point.events)} events
                </span>
                <span>
                  <i className="dashboard-legend-errors" />
                  {formatNumber(point.errors)} errors
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="dashboard-chart-x-axis" aria-hidden="true">
        {xAxisLabelIndexes.map((index) => {
          const point = props.points[index];

          if (!point) {
            return null;
          }

          const position =
            props.points.length === 1
              ? 0
              : (index / (props.points.length - 1)) * 100;
          const edgeClass =
            index === 0
              ? " dashboard-chart-x-start"
              : index === props.points.length - 1
                ? " dashboard-chart-x-end"
                : "";
          return (
            <span
              className={`dashboard-chart-x-label${edgeClass}`}
              key={point.bucket}
              style={{ left: `${position}%` }}
            >
              {formatChartBucket(point.bucket, props.range)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function getChartTicks(maxValue: number) {
  const top = getNiceChartMax(maxValue);
  const middle = top / 2;

  return [top, middle, 0].map((tick) =>
    Number.isInteger(tick) ? tick : Number(tick.toFixed(1)),
  );
}

function getNiceChartMax(value: number) {
  if (value <= 1) {
    return 1;
  }

  const exponent = Math.floor(Math.log10(value));
  const magnitude = 10 ** exponent;
  const normalized = value / magnitude;
  const niceNormalized =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;

  return niceNormalized * magnitude;
}

function getChartLabelIndexes(length: number, range: DashboardRange) {
  if (length <= 0) {
    return [];
  }

  const targetLabels = range === "24h" ? 5 : 8;
  const step = Math.max(1, Math.ceil((length - 1) / (targetLabels - 1)));
  const indexes = new Set<number>();

  for (let index = 0; index < length; index += step) {
    indexes.add(index);
  }

  indexes.add(length - 1);

  return Array.from(indexes).sort((a, b) => a - b);
}

function formatChartBucket(value: string, range: DashboardRange) {
  const date = new Date(value);

  if (range === "24h") {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (range === "30d") {
    return date.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "2-digit",
    });
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function formatChartTooltipDate(value: string, range: DashboardRange) {
  const date = new Date(value);

  if (range === "24h") {
    return date.toLocaleString(undefined, {
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      month: "short",
    });
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatNumber(value?: number) {
  return (value ?? 0).toLocaleString();
}
