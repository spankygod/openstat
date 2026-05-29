import Image from "next/image";
import Link from "next/link";

export default function QuickstartPage() {
  return (
    <main className="content-page">
      <nav className="content-nav" aria-label="Quickstart navigation">
        <Link className="content-brand" href="/">
          <Image
            aria-hidden="true"
            alt=""
            className="landing-brand-logo"
            height={32}
            src="/assets/logo.svg"
            width={32}
          />
          OpenStat
        </Link>
        <div className="content-nav-links">
          <Link href="/docs">Docs</Link>
          <Link href="/quickstart">Quickstart</Link>
          <Link href="/sdk">SDKs</Link>
        </div>
      </nav>

      <article className="content-article">
        <p className="content-kicker">Quickstart</p>
        <h1>Send your first OpenStat telemetry event.</h1>
        <p>
          Create an ingestion key, install the SDK for your runtime, and record
          one decision so OpenStat can build a decision-to-trade timeline.
        </p>

        <section className="content-step">
          <span>01</span>
          <div>
            <h2>Create an ingestion key</h2>
            <p>
              Create a project API key and expose it to your agent runtime as
              <code>OPENSTAT_API_KEY</code>.
            </p>
            <pre>
              <code>{`OPENSTAT_API_KEY=ostat_...\nOPENSTAT_ENDPOINT=http://localhost:4000`}</code>
            </pre>
          </div>
        </section>

        <section className="content-step">
          <span>02</span>
          <div>
            <h2>Install an SDK</h2>
            <p>
              OpenStat has TypeScript and Python helpers for native telemetry
              and OpenTelemetry HTTP exporter configuration.
            </p>
            <pre>
              <code>{`pnpm add openstat\npip install openstat`}</code>
            </pre>
          </div>
        </section>

        <section className="content-step">
          <span>03</span>
          <div>
            <h2>Record a decision</h2>
            <p>
              Start with one run and one decision event, then add risk checks,
              orders, fills, PnL snapshots, and heartbeats.
            </p>
            <pre>
              <code>{`const run = openstat.startAgentRun({ strategy: "breakout" });

await openstat.recordDecision({
  runId: run.runId,
  agent: { id: "agent-1", name: "Paper Trader" },
  strategy: "breakout",
  symbol: "BTC-USD",
  venue: "paper",
  action: "enter_long",
  confidence: 82,
  rationaleSummary: "Momentum and risk budget aligned.",
});`}</code>
            </pre>
          </div>
        </section>
      </article>
    </main>
  );
}
