import type { ReactNode } from "react";

import type {
  DashboardData,
  DashboardInspectorData,
  DashboardRange,
} from "../../lib/openstat-api";
import { DashboardTopToolbar } from "./dashboard-components";
import { DashboardInspector } from "./dashboard-inspector";
import { DashboardSidebar } from "./dashboard-sidebar";

export function DashboardRouteShell(props: {
  children: ReactNode;
  closeHref?: string;
  data: DashboardData;
  inspector?: DashboardInspectorData;
  range: DashboardRange;
  title: string;
}) {
  const rangeBasePath = props.closeHref?.split("?")[0] ?? "/dashboard";
  const unreadNotifications =
    props.data.analytics?.totals.unreadNotifications ??
    props.data.notifications.filter(
      (notification) => notification.status === "unread",
    ).length;

  return (
    <div className="dashboard-layout">
      <DashboardSidebar />

      <main className="shell dashboard-content">
        <DashboardTopToolbar
          range={props.range}
          rangeBasePath={rangeBasePath}
          title={props.title}
          unreadNotifications={unreadNotifications}
        />

        {props.children}
      </main>

      <DashboardInspector
        closeHref={props.closeHref ?? `/dashboard?range=${props.range}`}
        inspector={props.inspector}
      />
    </div>
  );
}
