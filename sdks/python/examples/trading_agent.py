from openstat import OpenStatClient


client = OpenStatClient(
    api_key="ostat_demo_secret",
    endpoint="http://localhost:4000",
    service_name="python-paper-trader",
    environment="development",
)

agent = {"id": "python-paper-trader", "name": "Python Paper Trader"}
run = client.start_agent_run(strategy="breakout")

client.send_heartbeat(agent=agent, status="online")
client.record_decision(
    agent=agent,
    run_id=run["run_id"],
    strategy="breakout",
    symbol="BTC-USD",
    venue="paper",
    action="enter_long",
    confidence=82,
    rationale_summary="Momentum and risk budget aligned.",
)
client.record_order(
    agent=agent,
    run_id=run["run_id"],
    order_id="order-demo-1",
    strategy="breakout",
    symbol="BTC-USD",
    venue="paper",
    side="buy",
    order_type="limit",
    quantity="0.10",
    price="62500",
    status="submitted",
)
