import { formatDateTime } from "./dashboard-components";
import type { DashboardData, DashboardRange } from "./dashboard-overview-types";

export function getDashboardAttentionItems(
  data: DashboardData,
  range: DashboardRange,
) {
  return [
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
        tone:
          notification.status === "read"
            ? ("neutral" as const)
            : ("warning" as const),
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
}
