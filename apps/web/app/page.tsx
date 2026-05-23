import Link from "next/link";

import { SignInModal } from "./sign-in-modal";

const metrics = [
  { label: "Agents", value: "12" },
  { label: "Events", value: "1.8M" },
  { label: "Risk rejects", value: "42" },
  { label: "Realized PnL", value: "+8.4%" },
];

const timeline = [
  {
    type: "Decision",
    title: "Mean reversion entry",
    detail: "Model selected ETH-USDC after spread normalized.",
    status: "accepted",
    time: "09:41:12",
  },
  {
    type: "Risk check",
    title: "Exposure guard",
    detail: "Max drawdown and venue limits passed.",
    status: "passed",
    time: "09:41:13",
  },
  {
    type: "Order",
    title: "Buy 2.4 ETH",
    detail: "Limit order routed to Coinbase Advanced.",
    status: "open",
    time: "09:41:15",
  },
  {
    type: "Fill",
    title: "2.4 ETH at 3,421.80",
    detail: "Order filled in two partial executions.",
    status: "filled",
    time: "09:41:21",
  },
  {
    type: "PnL",
    title: "+184.22 realized",
    detail: "Run outcome linked back to the original decision.",
    status: "closed",
    time: "10:07:03",
  },
];

const features = [
  {
    eyebrow: "Timeline",
    title: "Follow every run from prompt to position.",
    copy: "OpenStat connects market context, model reasoning, tool calls, risk gates, orders, fills, and final outcome in one traceable path.",
  },
  {
    eyebrow: "Ingestion",
    title: "Send native events or OpenTelemetry.",
    copy: "Use SDK helpers for trading events, ship OTLP signals from existing agents, and keep project-scoped telemetry organized from day one.",
  },
  {
    eyebrow: "Risk",
    title: "Catch rejects, drift, and silent failures.",
    copy: "Monitor stale heartbeats, repeated errors, rejected trades, token usage, and PnL changes before they become expensive mysteries.",
  },
];

export default function Home() {
  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Main navigation">
        <Link className="landing-brand" href="/">
          <span aria-hidden="true">O</span>
          OpenStat
        </Link>
        <div className="landing-nav-links">
          <a href="#product">Product</a>
          <a href="#ingestion">Ingestion</a>
          <Link href="/dashboard">Dashboard</Link>
        </div>
        <SignInModal className="landing-nav-cta">
          Sign in
        </SignInModal>
      </nav>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <p className="landing-kicker">Observability for AI trading agents</p>
          <h1 id="landing-title">Know what your trading agents did, and why.</h1>
          <p className="landing-hero-text">
            OpenStat turns decision-to-trade telemetry into timelines your team can inspect:
            model reasoning, risk checks, orders, fills, PnL, and alerts in one product view.
          </p>
          <div className="landing-actions">
            <SignInModal className="landing-button landing-button-primary">
              Start tracking
            </SignInModal>
            <Link className="landing-button landing-button-secondary" href="/dashboard">
              View dashboard
            </Link>
          </div>
        </div>

        <section className="landing-preview" aria-label="OpenStat product preview">
          <div className="landing-preview-header">
            <div>
              <span>Live run</span>
              <strong>ETH-USDC mean reversion</strong>
            </div>
            <small>healthy</small>
          </div>
          <div className="landing-metrics" aria-label="Telemetry metrics">
            {metrics.map((metric) => (
              <div className="landing-metric" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
          <div className="landing-preview-list">
            {timeline.map((item) => (
              <article className="landing-preview-row" key={`${item.type}-${item.time}`}>
                <div className="landing-row-marker" aria-hidden="true" />
                <div>
                  <span>{item.type}</span>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
                <small>{item.status}</small>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="landing-section" id="product" aria-labelledby="product-title">
        <div className="landing-section-heading">
          <p className="landing-kicker">Decision-to-trade clarity</p>
          <h2 id="product-title">One timeline for every autonomous trade.</h2>
        </div>
        <div className="landing-timeline-panel">
          {timeline.map((item) => (
            <div className="landing-timeline-item" key={item.type}>
              <span>{item.time}</span>
              <strong>{item.type}</strong>
              <p>{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-feature-grid" id="ingestion" aria-label="OpenStat capabilities">
        {features.map((feature) => (
          <article className="landing-feature" key={feature.title}>
            <span>{feature.eyebrow}</span>
            <h2>{feature.title}</h2>
            <p>{feature.copy}</p>
          </article>
        ))}
      </section>

      <section className="landing-band" aria-labelledby="risk-title">
        <div>
          <p className="landing-kicker">Risk and PnL</p>
          <h2 id="risk-title">See the rejected trades and the wins that made it through.</h2>
        </div>
        <div className="landing-band-stats" aria-label="Risk and performance stats">
          <div>
            <span>Rejected by risk</span>
            <strong>42</strong>
          </div>
          <div>
            <span>Fill latency p95</span>
            <strong>320ms</strong>
          </div>
          <div>
            <span>Realized PnL</span>
            <strong>+8.4%</strong>
          </div>
        </div>
      </section>

      <section className="landing-final" aria-labelledby="final-title">
        <p className="landing-kicker">Built for agents that trade real money</p>
        <h2 id="final-title">Instrument the decision before you debug the outcome.</h2>
        <SignInModal className="landing-button landing-button-primary">
          Start tracking
        </SignInModal>
      </section>
    </main>
  );
}
