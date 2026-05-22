import { createOpenStatClient } from "../src/index.js";

const openstat = createOpenStatClient({
  apiKey: process.env.OPENSTAT_API_KEY ?? "ostat_demo_secret",
  endpoint: process.env.OPENSTAT_API_URL ?? "http://localhost:4000",
  serviceName: "node-paper-trader",
  environment: "development",
});

const agent = { id: "node-paper-trader", name: "Node Paper Trader" };
const run = openstat.startAgentRun({ strategy: "breakout" });

await openstat.sendHeartbeat({ agent, status: "online" });
await openstat.recordDecision({
  agent,
  runId: run.runId,
  strategy: "breakout",
  symbol: "BTC-USD",
  venue: "paper",
  action: "enter_long",
  confidence: 82,
  rationaleSummary: "Momentum and risk budget aligned.",
});
await openstat.recordRiskCheck({
  agent,
  runId: run.runId,
  result: "approved",
  reason: "Risk budget available.",
});
await openstat.recordOrder({
  agent,
  runId: run.runId,
  orderId: "order-demo-1",
  strategy: "breakout",
  symbol: "BTC-USD",
  venue: "paper",
  side: "buy",
  orderType: "limit",
  quantity: "0.10",
  price: "62500",
  status: "submitted",
});
await openstat.recordFill({
  agent,
  runId: run.runId,
  fillId: "fill-demo-1",
  orderId: "order-demo-1",
  strategy: "breakout",
  symbol: "BTC-USD",
  venue: "paper",
  side: "buy",
  quantity: "0.10",
  price: "62495.50",
  fee: "1.25",
});
await openstat.recordPnlSnapshot({
  agent,
  strategy: "breakout",
  symbol: "BTC-USD",
  realizedPnl: "0",
  unrealizedPnl: "41.20",
  equity: "10041.20",
});
