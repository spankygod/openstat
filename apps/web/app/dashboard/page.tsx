import {
  getDashboardData,
  getDashboardInspectorData,
} from "../../lib/openstat-api";
import { DashboardTopToolbar } from "./dashboard-components";
import { DashboardInspector } from "./dashboard-inspector";
import {
  DashboardCommandGrid,
  DashboardLatestTables,
  DashboardSummaryKpis,
  getDashboardAttentionItems,
} from "./dashboard-overview-sections";
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
  const unreadNotifications =
    totals.unreadNotifications ??
    data.notifications.filter(
      (notification) => notification.status === "unread",
    ).length;
  const attentionItems = getDashboardAttentionItems(data, range);

  return (
    <div className="dashboard-layout">
      <DashboardSidebar />

      <main className="shell dashboard-content" id="overview">
        <DashboardTopToolbar
          errorCount={data.errors.length}
          range={range}
          showSignIn={data.errors.some((error) =>
            error.includes("returned 401"),
          )}
          unreadNotifications={unreadNotifications}
        />

        {data.errors.length > 0 ? (
          <section className="notice" id="backend-notice">
            <strong>Backend connection needs attention.</strong>
            <span>{data.errors.slice(0, 2).join(" | ")}</span>
          </section>
        ) : null}

        <DashboardSummaryKpis data={data} />
        <DashboardCommandGrid
          attentionItems={attentionItems}
          data={data}
          range={range}
        />
        <DashboardLatestTables data={data} range={range} />
      </main>

      <DashboardInspector
        closeHref={`/dashboard?range=${range}`}
        inspector={inspector}
      />
    </div>
  );
}
