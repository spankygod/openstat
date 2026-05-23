import { getDashboardData } from "../../../lib/openstat-api";
import {
  DashboardDataTable,
  DashboardEmptyState,
  DashboardPanel,
  DashboardStatusChip,
  formatDateTime,
} from "../dashboard-components";
import {
  getFirstParam,
  parseDashboardRange,
  type DashboardSearchParams,
} from "../dashboard-page-utils";
import { DashboardRouteShell } from "../dashboard-route-shell";

type ApiKeysPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function ApiKeysPage(props: ApiKeysPageProps) {
  const searchParams = await props.searchParams;
  const range = parseDashboardRange(getFirstParam(searchParams?.range));
  const data = await getDashboardData(range);

  return (
    <DashboardRouteShell
      closeHref={`/dashboard/api-keys?range=${range}`}
      data={data}
      range={range}
      title="API keys"
    >
      <DashboardPanel title="Project keys">
        {data.apiKeys.length === 0 ? (
          <DashboardEmptyState>
            No visible API keys. Sign in to manage keys.
          </DashboardEmptyState>
        ) : (
          <DashboardDataTable
            empty="No visible API keys. Sign in to manage keys."
            items={data.apiKeys}
            columns={[
              {
                key: "name",
                label: "Name",
                render: (apiKey) => apiKey.name,
              },
              {
                key: "prefix",
                label: "Prefix",
                render: (apiKey) => apiKey.prefix,
              },
              {
                key: "status",
                label: "Status",
                render: (apiKey) => (
                  <DashboardStatusChip
                    status={apiKey.revokedAt ? "revoked" : "active"}
                  />
                ),
              },
              {
                key: "created",
                label: "Created",
                render: (apiKey) => formatDateTime(apiKey.createdAt),
              },
            ]}
          />
        )}
      </DashboardPanel>
    </DashboardRouteShell>
  );
}
