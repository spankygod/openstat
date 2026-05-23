import type { getDashboardData, DashboardRange } from "../../lib/openstat-api";

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
export type DashboardAttentionTone = "danger" | "warning" | "neutral";

export type DashboardAttentionEntry = {
  href: string;
  meta: string;
  title: string;
  tone: DashboardAttentionTone;
};

export type { DashboardRange };
