import {
  getDashboardData,
  getDashboardInspectorData,
} from "../../../lib/openstat-api";
import {
  DashboardDataTable,
  DashboardKpiCard,
  DashboardPanel,
  DashboardStatusChip,
  formatNumber,
} from "../dashboard-components";
import {
  getFirstParam,
  parseDashboardRange,
  parseInspectorKind,
  type DashboardSearchParams,
} from "../dashboard-page-utils";
import { DashboardRouteShell } from "../dashboard-route-shell";

type TradesPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function TradesPage(props: TradesPageProps) {
  const searchParams = await props.searchParams;
  const range = parseDashboardRange(getFirstParam(searchParams?.range));
  const inspect = parseInspectorKind(getFirstParam(searchParams?.inspect));
  const inspectId = getFirstParam(searchParams?.id);
  const data = await getDashboardData(range);
  const totals = data.analytics?.totals ?? {};
  const inspector =
    inspect && inspectId
      ? await getDashboardInspectorData(inspect, inspectId)
      : undefined;

  return (
    <DashboardRouteShell
      closeHref={`/dashboard/trades?range=${range}`}
      data={data}
      inspector={inspector}
      range={range}
      title="Trades"
    >
      <section className="dashboard-kpi-grid dashboard-route-kpis">
        <DashboardKpiCard
          href="/dashboard/trades"
          label="Orders"
          meta={`Across ${range}`}
          value={formatNumber(totals.orders)}
        />
        <DashboardKpiCard
          href="/dashboard/trades"
          label="Fills"
          meta="Execution events"
          value={formatNumber(totals.fills)}
        />
        <DashboardKpiCard
          href="/dashboard/trades"
          label="Risk rejects"
          meta="Blocked by policy"
          tone={(totals.riskRejects ?? 0) > 0 ? "warning" : "success"}
          value={formatNumber(totals.riskRejects)}
        />
        <DashboardKpiCard
          href="/dashboard/trades"
          label="PnL snapshots"
          meta="Projected outcomes"
          value={formatNumber(totals.pnlSnapshots)}
        />
      </section>

      <DashboardPanel title="Trade outcomes">
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
                  href={`/dashboard/trades?range=${range}&inspect=trade&id=${trade.id}`}
                >
                  {trade.side.toUpperCase()} {trade.symbol}
                </a>
              ),
            },
            {
              key: "strategy",
              label: "Strategy",
              render: (trade) => trade.strategy ?? "Unassigned",
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
    </DashboardRouteShell>
  );
}
