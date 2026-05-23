import { CircleCheck } from "lucide-react";
import type { ReactNode } from "react";

export function DashboardEmptyState(props: { children: ReactNode }) {
  return (
    <div className="dashboard-empty">
      <CircleCheck aria-hidden="true" size={18} />
      <p>{props.children}</p>
    </div>
  );
}
