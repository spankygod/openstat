import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function SdkPage() {
  return (
    <main className="content-page">
      <nav className="content-nav" aria-label="SDK navigation">
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

      <section className="content-hero" aria-labelledby="sdk-title">
        <p className="content-kicker">SDKs</p>
        <h1 id="sdk-title">
          Instrument trading agents without rebuilding telemetry.
        </h1>
        <p>
          The TypeScript and Python SDKs share the same OpenStat telemetry
          model, so teams can compare agent runs across languages and execution
          environments.
        </p>
      </section>

      <section className="content-grid" aria-label="SDK options">
        <article className="content-card">
          <span>TypeScript</span>
          <h2>openstat</h2>
          <p>
            Record agent runs, decisions, risk checks, orders, fills, PnL
            snapshots, and heartbeats from Node-based agents.
          </p>
          <pre>
            <code>{`pnpm add openstat`}</code>
          </pre>
          <Link className="content-card-link" href="/quickstart">
            Use in quickstart
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </article>
        <article className="content-card">
          <span>Python</span>
          <h2>openstat</h2>
          <p>
            Send the same decision-to-trade telemetry from Python agents and
            scripts.
          </p>
          <pre>
            <code>{`pip install openstat`}</code>
          </pre>
          <Link className="content-card-link" href="/quickstart">
            Use in quickstart
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </article>
        <article className="content-card">
          <span>OTLP/HTTP</span>
          <h2>Exporter config</h2>
          <p>
            SDK helpers expose endpoint and authorization settings for traces,
            logs, and metrics exporters.
          </p>
          <pre>
            <code>{`Authorization: Bearer ostat_...`}</code>
          </pre>
          <Link className="content-card-link" href="/docs">
            Read docs
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </article>
      </section>
    </main>
  );
}
