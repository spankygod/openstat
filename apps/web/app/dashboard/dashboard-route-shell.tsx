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
          errorCount={props.data.errors.length}
          range={props.range}
          rangeBasePath={rangeBasePath}
          title={props.title}
          unreadNotifications={unreadNotifications}
        />

        {props.data.errors.length > 0 ? (
          <section className="notice" id="backend-notice">
            <strong>Backend connection needs attention.</strong>
            <span>{props.data.errors.slice(0, 2).join(" | ")}</span>
          </section>
        ) : null}

        {props.children}
      </main>

      <DashboardInspector
        closeHref={props.closeHref ?? `/dashboard?range=${props.range}`}
        inspector={props.inspector}
      />
    </div>
  );
}
