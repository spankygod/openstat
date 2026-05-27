import type {
  DashboardInspectorKind,
  DashboardRange,
} from "../../lib/openstat-api";

export type DashboardSearchParams = {
  cursor?: string | string[];
  cursorStack?: string | string[];
  eventScope?: string | string[];
  id?: string | string[];
  inspect?: string | string[];
  range?: string | string[];
};

export function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseDashboardRange(value: string | undefined): DashboardRange {
  if (value === "24h" || value === "7d" || value === "30d") {
    return value;
  }

  return "7d";
}

export function parseInspectorKind(
  value: string | undefined,
): DashboardInspectorKind | undefined {
  if (
    value === "agent" ||
    value === "event" ||
    value === "notification" ||
    value === "run" ||
    value === "trace" ||
    value === "trade"
  ) {
    return value;
  }

  return undefined;
}
