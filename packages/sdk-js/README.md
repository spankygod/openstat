# openstat

TypeScript helpers for sending native OpenStat telemetry from AI trading agents.

```ts
import { createOpenStatClient } from "openstat";

const openstat = createOpenStatClient({
  apiKey: process.env.OPENSTAT_API_KEY!,
  endpoint: "https://api.example.com",
  serviceName: "paper-trader",
  environment: "production",
});

const run = openstat.startAgentRun({ strategy: "breakout" });

await openstat.recordDecision({
  runId: run.runId,
  agent: { id: "agent-1", name: "Paper Trader" },
  strategy: "breakout",
  symbol: "BTC-USD",
  venue: "paper",
  action: "enter_long",
  confidence: 82,
  rationaleSummary: "Momentum and risk budget aligned.",
});
```

For OpenTelemetry exporters, use `createOpenTelemetryHttpConfig` to get the
OTLP/HTTP endpoints and authorization headers for traces, logs, and metrics.
