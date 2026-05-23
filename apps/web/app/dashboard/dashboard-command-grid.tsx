import {
  DashboardAttentionItem,
  DashboardEmptyState,
  DashboardPanel,
} from "./dashboard-components";
import { DashboardMiniTrend } from "./dashboard-mini-trend";
import type {
  DashboardAttentionEntry,
  DashboardData,
  DashboardRange,
} from "./dashboard-overview-types";

export function DashboardCommandGrid(props: {
  attentionItems: DashboardAttentionEntry[];
  data: DashboardData;
  range: DashboardRange;
}) {
  return (
    <section className="dashboard-command-grid">
      <DashboardPanel
        actions={<span className="dashboard-panel-note">Events / errors</span>}
        className="dashboard-command-main"
        eyebrow="Command center"
        title="Decision-to-trade activity"
      >
        <DashboardMiniTrend
          points={props.data.analytics?.series ?? []}
          range={props.range}
        />
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
        {props.attentionItems.length > 0 ? (
          <div className="dashboard-attention-list">
            {props.attentionItems.map((item) => (
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
          <DashboardEmptyState>
            No urgent agent issues in this range.
          </DashboardEmptyState>
        )}
      </DashboardPanel>
    </section>
  );
}
