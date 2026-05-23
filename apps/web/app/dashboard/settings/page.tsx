import { getDashboardData } from "../../../lib/openstat-api";
import {
  DashboardPanel,
  DashboardStatusChip,
} from "../dashboard-components";
import {
  getFirstParam,
  parseDashboardRange,
  type DashboardSearchParams,
} from "../dashboard-page-utils";
import { DashboardRouteShell } from "../dashboard-route-shell";

type SettingsPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function SettingsPage(props: SettingsPageProps) {
  const searchParams = await props.searchParams;
  const range = parseDashboardRange(getFirstParam(searchParams?.range));
  const data = await getDashboardData(range);

  return (
    <DashboardRouteShell
      closeHref={`/dashboard/settings?range=${range}`}
      data={data}
      range={range}
      title="Settings"
    >
      <div className="dashboard-settings-grid">
        <DashboardPanel title="Dashboard preferences">
          <dl className="dashboard-settings-list">
            <div>
              <dt>Default range</dt>
              <dd>{range}</dd>
            </div>
            <div>
              <dt>Inspector</dt>
              <dd>Right drawer</dd>
            </div>
            <div>
              <dt>Visual mode</dt>
              <dd>Dark control room</dd>
            </div>
          </dl>
        </DashboardPanel>

        <DashboardPanel title="Telemetry policy">
          <dl className="dashboard-settings-list">
            <div>
              <dt>Raw capture</dt>
              <dd>
                <DashboardStatusChip status="disabled" />
              </dd>
            </div>
            <div>
              <dt>Redaction</dt>
              <dd>
                <DashboardStatusChip status="active" />
              </dd>
            </div>
            <div>
              <dt>Derived retention</dt>
              <dd>1 year target</dd>
            </div>
          </dl>
        </DashboardPanel>
      </div>
    </DashboardRouteShell>
  );
}
