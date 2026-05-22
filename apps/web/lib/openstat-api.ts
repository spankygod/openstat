const apiUrl = process.env.NEXT_PUBLIC_OPENSTAT_API_URL ?? "http://localhost:4000";
const dashboardApiKey = process.env.OPENSTAT_DASHBOARD_API_KEY;

export type DashboardData = {
  overview?: DashboardOverview;
  analytics?: {
    totals: Record<string, number>;
  };
  agents: Array<DashboardAgent>;
  runs: Array<DashboardRun>;
  trades: Array<DashboardTrade>;
  notifications: Array<DashboardNotification>;
  apiKeys: Array<DashboardApiKey>;
  errors: string[];
};

export type DashboardOverview = {
  agents: {
    total: number;
    byStatus: Record<string, number>;
  };
  events: {
    total: number;
    latest: Array<DashboardEvent>;
  };
};

export type DashboardAgent = {
  id: string;
  name: string;
  externalId?: string | null;
  status: string;
  lastSeenAt?: string | null;
};

export type DashboardEvent = {
  id: string;
  eventType: string;
  timestamp: string;
  source: string;
};

export type DashboardRun = {
  id: string;
  externalRunId?: string | null;
  strategy?: string | null;
  status: string;
  startedAt: string;
};

export type DashboardTrade = {
  id: string;
  strategy?: string | null;
  symbol: string;
  side: string;
  status: string;
  quantity: string;
  price?: string | null;
  createdAt: string;
};

export type DashboardNotification = {
  id: string;
  type: string;
  status: string;
  title: string;
  message?: string | null;
  createdAt: string;
};

export type DashboardApiKey = {
  id: string;
  name: string;
  prefix: string;
  revokedAt?: string | null;
  createdAt: string;
};

export async function getDashboardData(): Promise<DashboardData> {
  const [overview, analytics, agents, runs, trades, notifications, apiKeys] =
    await Promise.all([
      getJson<DashboardOverview>("/v1/overview"),
      getJson<{ totals: Record<string, number> }>("/v1/analytics/summary?range=7d"),
      getJson<{ agents: DashboardAgent[] }>("/v1/agents?limit=12"),
      getJson<{ runs: DashboardRun[] }>("/v1/runs?limit=8"),
      getJson<{ trades: DashboardTrade[] }>("/v1/trades?limit=8"),
      getJson<{ notifications: DashboardNotification[] }>("/v1/notifications?limit=8"),
      getJson<{ apiKeys: DashboardApiKey[] }>("/v1/api-keys"),
    ]);

  return {
    overview: overview.ok ? overview.data : undefined,
    analytics: analytics.ok ? analytics.data : undefined,
    agents: agents.ok ? agents.data.agents : [],
    runs: runs.ok ? runs.data.runs : [],
    trades: trades.ok ? trades.data.trades : [],
    notifications: notifications.ok ? notifications.data.notifications : [],
    apiKeys: apiKeys.ok ? apiKeys.data.apiKeys : [],
    errors: [
      overview,
      analytics,
      agents,
      runs,
      trades,
      notifications,
      apiKeys,
    ].flatMap((result) => (result.ok ? [] : [result.error])),
  };
}

async function getJson<T>(path: string): Promise<
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    }
> {
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      cache: "no-store",
      headers: {
        ...(dashboardApiKey ? { authorization: `Bearer ${dashboardApiKey}` } : {}),
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `${path} returned ${response.status}`,
      };
    }

    return {
      ok: true,
      data: (await response.json()) as T,
    };
  } catch (error) {
    return {
      ok: false,
      error: `${path} failed: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}
