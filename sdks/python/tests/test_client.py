from openstat import OpenStatClient, create_opentelemetry_http_config


class FakeResponse:
    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return b'{"accepted":true}'


def test_record_decision_emits_native_event(monkeypatch):
    captured = {}

    def fake_urlopen(req, timeout):
        captured["url"] = req.full_url
        captured["headers"] = dict(req.header_items())
        captured["body"] = req.data.decode("utf-8")
        captured["timeout"] = timeout
        return FakeResponse()

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    client = OpenStatClient(
        api_key="ostat_public_secret",
        endpoint="http://localhost:4000",
        service_name="pytest-agent",
    )

    result = client.record_decision(
        agent={"id": "agent-test"},
        strategy="breakout",
        symbol="BTC-USD",
        action="enter_long",
    )

    assert result == {"accepted": True}
    assert captured["url"] == "http://localhost:4000/v1/ingest/events"
    assert "Bearer ostat_public_secret" in captured["headers"]["Authorization"]
    assert '"type": "decision"' in captured["body"]
    assert '"service_name": "pytest-agent"' in captured["body"]


def test_opentelemetry_config_returns_otlp_http_targets():
    config = create_opentelemetry_http_config(
        api_key="ostat_public_secret",
        endpoint="https://api.example.com",
        service_name="pytest-agent",
    )

    assert config["traces"]["url"] == "https://api.example.com/v1/traces"
    assert config["logs"]["url"] == "https://api.example.com/v1/logs"
    assert config["metrics"]["headers"]["authorization"] == "Bearer ostat_public_secret"
