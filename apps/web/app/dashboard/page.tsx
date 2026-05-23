import {
  getDashboardData,
  getDashboardInspectorData,
} from "../../lib/openstat-api";
import {
  DashboardAttentionItem,
  DashboardDataTable,
  DashboardEmptyState,
  DashboardKpiCard,
  DashboardMiniTrend,
  DashboardPanel,
  DashboardStatusChip,
  DashboardTopToolbar,
  formatDateTime,
  formatNumber,
} from "./dashboard-components";
import { DashboardInspector } from "./dashboard-inspector";
import {
  getFirstParam,
  parseDashboardRange,
  parseInspectorKind,
  type DashboardSearchParams,
} from "./dashboard-page-utils";
import { DashboardSidebar } from "./dashboard-sidebar";

type DashboardProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function Dashboard(props: DashboardProps) {
  const searchParams = await props.searchParams;
  const range = parseDashboardRange(getFirstParam(searchParams?.range));
  const inspect = parseInspectorKind(getFirstParam(searchParams?.inspect));
  const inspectId = getFirstParam(searchParams?.id);
  const data = await getDashboardData(range);
  const inspector =
    inspect && inspectId
      ? await getDashboardInspectorData(inspect, inspectId)
      : undefined;
  const totals = data.analytics?.totals ?? {};
  const overview = data.overview;
  const onlineAgents =
    overview?.agents.byStatus.online ??
    overview?.agents.byStatus.active ??
    overview?.agents.byStatus.ok ??
    0;
  const unreadNotifications =
    totals.unreadNotifications ??
    data.notifications.filter((notification) => notification.status === "unread")
      .length;
  const attentionItems = [
    ...data.errors.map((error) => ({
      href: "#backend-notice",
      meta: "Backend connection",
      title: error,
      tone: "danger" as const,
    })),
    ...data.notifications
      .filter((notification) => notification.status !== "archived")
      .slice(0, 4)
      .map((notification) => ({
        href: `/dashboard?range=${range}&inspect=notification&id=${notification.id}`,
        meta: `${notification.type} | ${formatDateTime(notification.createdAt)}`,
        title: notification.title,
        tone: notification.status === "read" ? ("neutral" as const) : ("warning" as const),
      })),
    ...data.agents
      .filter((agent) =>
        ["stale", "offline", "failing", "error"].includes(
          agent.status.toLowerCase(),
        ),
      )
      .slice(0, 3)
      .map((agent) => ({
        href: `/dashboard?range=${range}&inspect=agent&id=${agent.id}`,
        meta: `Last seen ${formatDateTime(agent.lastSeenAt)}`,
        title: `${agent.name} is ${agent.status}`,
        tone: "warning" as const,
      })),
  ].slice(0, 7);

  return (
    <div className="dashboard-layout">
      <DashboardSidebar />

      <main className="shell dashboard-content" id="overview">
        <DashboardTopToolbar
          errorCount={data.errors.length}
          range={range}
          unreadNotifications={unreadNotifications}
        />

        {data.errors.length > 0 ? (
          <section className="notice" id="backend-notice">
            <strong>Backend connection needs attention.</strong>
            <span>{data.errors.slice(0, 2).join(" | ")}</span>
          </section>
        ) : null}

        <section className="dashboard-kpi-grid" aria-label="Dashboard summary">
          <DashboardKpiCard
            href="/dashboard/agents"
            label="Agents online"
            meta={`${formatNumber(overview?.agents.total)} total agents`}
            tone={onlineAgents > 0 ? "success" : "warning"}
            value={formatNumber(onlineAgents)}
          />
          <DashboardKpiCard
            href="/dashboard?inspect=events"
            label="Events"
            meta={`Across ${range}`}
            value={formatNumber(overview?.events.total)}
          />
          <DashboardKpiCard
            href="/dashboard/runs"
            label="Decisions"
            meta="Decision events"
            value={formatNumber(totals.decisions)}
          />
          <DashboardKpiCard
            href="/dashboard/trades"
            label="Orders / fills"
            meta={`${formatNumber(totals.fills)} fills`}
            value={`${formatNumber(totals.orders)} / ${formatNumber(totals.fills)}`}
          />
          <DashboardKpiCard
            href="/dashboard/trades"
            label="Risk rejects"
            meta="Blocked before execution"
            tone={(totals.riskRejects ?? 0) > 0 ? "warning" : "success"}
            value={formatNumber(totals.riskRejects)}
          />
          <DashboardKpiCard
            href="/dashboard/alerts"
            label="Failures"
            meta="Errors and failed batches"
            tone={(totals.failures ?? 0) > 0 ? "danger" : "success"}
            value={formatNumber(totals.failures)}
          />
          <DashboardKpiCard
            href="/dashboard/trades"
            label="PnL snapshots"
            meta="Projected outcomes"
            value={formatNumber(totals.pnlSnapshots)}
          />
        </section>

        <section className="dashboard-command-grid">
          <DashboardPanel
            actions={<span className="dashboard-panel-note">Events / errors</span>}
            className="dashboard-command-main"
            eyebrow="Command center"
            title="Decision-to-trade activity"
          >
            <DashboardMiniTrend points={data.analytics?.series ?? []} />
            <div className="dashboard-chart-legend">
              <span>
                <i className="dashboard-legend-events" /> Events
              </span>
              <span>
                <i className="dashboard-legend-errors" /> Errors
              </span>
            </div>
          </DashboardPanel>

          <DashboardPanel
            className="dashboard-attention-panel"
            id="alerts"
            title="Needs attention"
          >
            {attentionItems.length > 0 ? (
              <div className="dashboard-attention-list">
                {attentionItems.map((item) => (
                  <DashboardAttentionItem
                    href={item.href}
                    key={`${item.href}-${item.title}`}
                    meta={item.meta}
                    title={item.title}
                    tone={item.tone}
                  />
                ))}
              </div>
            ) : (
              <DashboardEmptyState>No urgent agent issues in this range.</DashboardEmptyState>
            )}
          </DashboardPanel>
        </section>

        <section className="dashboard-table-grid">
          <DashboardPanel
            actions={<a href="/dashboard/runs">View all</a>}
            id="runs"
            title="Latest runs"
          >
            <DashboardDataTable
              empty="No runs yet."
              items={data.runs}
              columns={[
                {
                  key: "run",
                  label: "Run",
                  render: (run) => (
                    <a
                      className="dashboard-table-primary"
                      href={`/dashboard?range=${range}&inspect=run&id=${run.id}`}
                    >
                      {run.strategy ?? run.externalRunId ?? run.id}
                    </a>
                  ),
                },
                {
                  key: "status",
                  label: "Status",
                  render: (run) => <DashboardStatusChip status={run.status} />,
                },
                {
                  key: "started",
                  label: "Started",
                  render: (run) => formatDateTime(run.startedAt),
                },
              ]}
            />
          </DashboardPanel>

          <DashboardPanel
            actions={<a href="/dashboard/trades">View all</a>}
            id="trades"
            title="Latest trades"
          >
            <DashboardDataTable
              empty="No trades yet."
              items={data.trades}
              columns={[
                {
                  key: "trade",
                  label: "Trade",
                  render: (trade) => (
                    <a
                      className="dashboard-table-primary"
                      href={`/dashboard?range=${range}&inspect=trade&id=${trade.id}`}
                    >
                      {trade.side.toUpperCase()} {trade.symbol}
                    </a>
                  ),
                },
                {
                  key: "value",
                  label: "Value",
                  render: (trade) =>
                    `${trade.quantity}${trade.price ? ` at ${trade.price}` : ""}`,
                },
                {
                  key: "status",
                  label: "Status",
                  render: (trade) => <DashboardStatusChip status={trade.status} />,
                },
              ]}
            />
          </DashboardPanel>

          <DashboardPanel
            actions={<a href="/dashboard?inspect=events">Explore</a>}
            className="dashboard-events-panel"
            title="Latest events"
          >
            <DashboardDataTable
              empty="No events ingested yet."
              items={overview?.events.latest ?? []}
              columns={[
                {
                  key: "event",
                  label: "Event",
                  render: (event) => (
                    <a
                      className="dashboard-table-primary"
                      href={`/dashboard?range=${range}&inspect=event&id=${event.id}`}
                    >
                      {event.eventType}
                    </a>
                  ),
                },
                {
                  key: "source",
                  label: "Source",
                  render: (event) => event.source,
                },
                {
                  key: "time",
                  label: "Time",
                  render: (event) => formatDateTime(event.timestamp),
                },
              ]}
            />
          </DashboardPanel>
        </section>
      </main>

      <DashboardInspector
        closeHref={`/dashboard?range=${range}`}
        inspector={inspector}
      />
    </div>
  );
}
