import { getDashboardData } from "../lib/openstat-api";

export default async function Home() {
  const data = await getDashboardData();
  const totals = data.analytics?.totals ?? {};
  const overview = data.overview;

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">OpenStat</p>
          <h1>AI trading agent telemetry</h1>
        </div>
        <a className="button" href="/api/auth/sign-in">
          Sign in
        </a>
      </header>

      {data.errors.length > 0 ? (
        <section className="notice">
          <strong>Backend connection needs attention.</strong>
          <span>{data.errors.slice(0, 2).join(" | ")}</span>
        </section>
      ) : null}

      <section className="metric-grid" aria-label="Dashboard summary">
        <Metric label="Agents" value={overview?.agents.total ?? 0} />
        <Metric label="Events" value={overview?.events.total ?? 0} />
        <Metric label="Decisions" value={totals.decisions ?? 0} />
        <Metric label="Orders" value={totals.orders ?? 0} />
        <Metric label="Fills" value={totals.fills ?? 0} />
        <Metric label="Risk rejects" value={totals.riskRejects ?? 0} />
      </section>

      <section className="dashboard-grid">
        <Panel title="Agents" empty={data.agents.length === 0 ? "No agents yet." : undefined}>
          {data.agents.map((agent) => (
            <Row
              key={agent.id}
              title={agent.name}
              meta={agent.externalId ?? agent.id}
              badge={agent.status}
            />
          ))}
        </Panel>

        <Panel title="API keys" empty={data.apiKeys.length === 0 ? "No visible API keys. Sign in to manage keys." : undefined}>
          {data.apiKeys.map((apiKey) => (
            <Row
              key={apiKey.id}
              title={apiKey.name}
              meta={apiKey.prefix}
              badge={apiKey.revokedAt ? "revoked" : "active"}
            />
          ))}
        </Panel>

        <Panel title="Run timeline" empty={data.runs.length === 0 ? "No runs yet." : undefined}>
          {data.runs.map((run) => (
            <Row
              key={run.id}
              title={run.strategy ?? run.externalRunId ?? run.id}
              meta={new Date(run.startedAt).toLocaleString()}
              badge={run.status}
            />
          ))}
        </Panel>

        <Panel title="Trades" empty={data.trades.length === 0 ? "No trades yet." : undefined}>
          {data.trades.map((trade) => (
            <Row
              key={trade.id}
              title={`${trade.side.toUpperCase()} ${trade.symbol}`}
              meta={`${trade.quantity}${trade.price ? ` at ${trade.price}` : ""}`}
              badge={trade.status}
            />
          ))}
        </Panel>

        <Panel title="Notifications" empty={data.notifications.length === 0 ? "No notifications." : undefined}>
          {data.notifications.map((notification) => (
            <Row
              key={notification.id}
              title={notification.title}
              meta={notification.message ?? notification.type}
              badge={notification.status}
            />
          ))}
        </Panel>

        <Panel title="Latest events" empty={(overview?.events.latest.length ?? 0) === 0 ? "No events ingested yet." : undefined}>
          {(overview?.events.latest ?? []).map((event) => (
            <Row
              key={event.id}
              title={event.eventType}
              meta={`${event.source} | ${new Date(event.timestamp).toLocaleString()}`}
              badge="event"
            />
          ))}
        </Panel>
      </section>
    </main>
  );
}

function Metric(props: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{props.label}</span>
      <strong>{props.value.toLocaleString()}</strong>
    </div>
  );
}

function Panel(props: {
  title: string;
  empty?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <h2>{props.title}</h2>
      {props.empty ? <p className="empty">{props.empty}</p> : props.children}
    </section>
  );
}

function Row(props: { title: string; meta: string; badge: string }) {
  return (
    <article className="row">
      <div>
        <strong>{props.title}</strong>
        <span>{props.meta}</span>
      </div>
      <small>{props.badge}</small>
    </article>
  );
}
