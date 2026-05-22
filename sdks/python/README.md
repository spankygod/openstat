# openstat Python SDK

Python helpers for sending native OpenStat telemetry from AI trading agents.

```python
from openstat import OpenStatClient

client = OpenStatClient(
    api_key="ostat_...",
    endpoint="https://api.example.com",
    service_name="paper-trader",
    environment="production",
)

run = client.start_agent_run(strategy="breakout")

client.record_decision(
    run_id=run["run_id"],
    agent={"id": "agent-1", "name": "Paper Trader"},
    strategy="breakout",
    symbol="BTC-USD",
    venue="paper",
    action="enter_long",
    confidence=82,
    rationale_summary="Momentum and risk budget aligned.",
)
```

Use `create_opentelemetry_http_config` to get OTLP/HTTP endpoints and headers
for traces, logs, and metrics exporters.
