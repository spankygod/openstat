export type AgentInput = {
  id?: string;
  name?: string;
  tags?: string[];
};

export type OpenStatClientConfig = {
  apiKey: string;
  endpoint?: string;
  serviceName: string;
  environment?: string;
  defaultRedaction?: boolean;
  fetch?: typeof fetch;
};

export type NativeEvent = {
  id?: string;
  schema_version?: 1;
  agent?: AgentInput;
  project_id?: string;
  type:
    | "decision"
    | "risk_check"
    | "order"
    | "fill"
    | "position"
    | "pnl_snapshot"
    | "heartbeat"
    | "error"
    | "completion";
  data: Record<string, unknown>;
  timestamp?: number;
  trace_id?: string;
  span_id?: string;
  run_id?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

export type TradingIdentity = {
  strategy?: string;
  symbol: string;
  venue?: string;
};

export type StartAgentRunInput = {
  runId?: string;
  strategy?: string;
  metadata?: Record<string, unknown>;
};

export function createOpenStatClient(config: OpenStatClientConfig) {
  return new OpenStatClient(config);
}

export class OpenStatClient {
  private readonly endpoint: string;
  private readonly fetcher: typeof fetch;

  constructor(private readonly config: OpenStatClientConfig) {
    this.endpoint = (config.endpoint ?? "http://localhost:4000").replace(/\/$/u, "");
    this.fetcher = config.fetch ?? fetch;
  }

  startAgentRun(input: StartAgentRunInput = {}) {
    return {
      runId: input.runId ?? createId("run"),
      strategy: input.strategy,
      metadata: this.createMetadata(input.metadata),
    };
  }

  async sendEvent(event: NativeEvent) {
    const response = await this.fetcher(`${this.endpoint}/v1/ingest/events`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(this.prepareEvent(event)),
    });

    return parseResponse(response);
  }

  async sendBatch(events: NativeEvent[]) {
    const response = await this.fetcher(`${this.endpoint}/v1/ingest/batch`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        events: events.map((event) => this.prepareEvent(event)),
      }),
    });

    return parseResponse(response);
  }

  recordDecision(input: {
    agent?: AgentInput;
    runId?: string;
    action: string;
    confidence?: number;
    rationaleSummary?: string;
  } & TradingIdentity) {
    return this.sendEvent({
      agent: input.agent,
      type: "decision",
      run_id: input.runId,
      data: {
        strategy: input.strategy,
        symbol: input.symbol,
        venue: input.venue,
        action: input.action,
        confidence: input.confidence,
        rationale_summary: input.rationaleSummary,
      },
    });
  }

  recordRiskCheck(input: {
    agent?: AgentInput;
    runId?: string;
    decisionId?: string;
    result: "approved" | "rejected" | "warn";
    reason?: string;
  }) {
    return this.sendEvent({
      agent: input.agent,
      type: "risk_check",
      run_id: input.runId,
      data: {
        decision_id: input.decisionId,
        result: input.result,
        reason: input.reason,
      },
    });
  }

  recordOrder(input: {
    agent?: AgentInput;
    runId?: string;
    orderId?: string;
    side: "buy" | "sell";
    orderType: "market" | "limit" | "stop" | "stop_limit";
    quantity: string | number;
    price?: string | number;
    status?: string;
  } & TradingIdentity) {
    return this.sendEvent({
      agent: input.agent,
      type: "order",
      run_id: input.runId,
      data: {
        order_id: input.orderId,
        strategy: input.strategy,
        symbol: input.symbol,
        venue: input.venue,
        side: input.side,
        order_type: input.orderType,
        quantity: input.quantity,
        price: input.price,
        status: input.status,
      },
    });
  }

  recordFill(input: {
    agent?: AgentInput;
    runId?: string;
    fillId?: string;
    orderId?: string;
    side: "buy" | "sell";
    quantity: string | number;
    price: string | number;
    fee?: string | number;
  } & TradingIdentity) {
    return this.sendEvent({
      agent: input.agent,
      type: "fill",
      run_id: input.runId,
      data: {
        fill_id: input.fillId,
        order_id: input.orderId,
        strategy: input.strategy,
        symbol: input.symbol,
        venue: input.venue,
        side: input.side,
        quantity: input.quantity,
        price: input.price,
        fee: input.fee,
      },
    });
  }

  recordPnlSnapshot(input: {
    agent?: AgentInput;
    strategy?: string;
    symbol?: string;
    realizedPnl?: string | number;
    unrealizedPnl?: string | number;
    equity?: string | number;
  }) {
    return this.sendEvent({
      agent: input.agent,
      type: "pnl_snapshot",
      data: {
        strategy: input.strategy,
        symbol: input.symbol,
        realized_pnl: input.realizedPnl,
        unrealized_pnl: input.unrealizedPnl,
        equity: input.equity,
      },
    });
  }

  sendHeartbeat(input: {
    agent?: AgentInput;
    status?: "online" | "stale" | "offline" | "failing" | "unknown";
    expectedCheckInSeconds?: number;
    summary?: string;
  } = {}) {
    return this.sendEvent({
      agent: input.agent,
      type: "heartbeat",
      data: {
        status: input.status ?? "online",
        expected_check_in_seconds: input.expectedCheckInSeconds,
        summary: input.summary,
      },
    });
  }

  recordModelUsage(input: {
    agent?: AgentInput;
    runId?: string;
    provider?: string;
    model?: string;
    status?: string;
    latencyMs?: number;
    inputTokens?: number;
    outputTokens?: number;
    summary?: string;
  }) {
    return this.sendEvent({
      agent: input.agent,
      type: "completion",
      run_id: input.runId,
      data: {
        provider: input.provider,
        model: input.model,
        status: input.status,
        latency_ms: input.latencyMs,
        usage: {
          input_tokens: input.inputTokens,
          output_tokens: input.outputTokens,
        },
        summary: input.summary,
      },
    });
  }

  recordToolCall(input: {
    agent?: AgentInput;
    runId?: string;
    toolName: string;
    status?: string;
    summary?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.sendEvent({
      agent: input.agent,
      type: "completion",
      run_id: input.runId,
      data: {
        status: input.status,
        summary: input.summary,
      },
      metadata: {
        ...input.metadata,
        tool_name: input.toolName,
      },
    });
  }

  createOpenTelemetryHttpConfig() {
    return createOpenTelemetryHttpConfig(this.config);
  }

  private prepareEvent(event: NativeEvent): NativeEvent {
    return {
      schema_version: 1,
      ...event,
      metadata: this.createMetadata(event.metadata),
      timestamp: event.timestamp ?? Date.now(),
    };
  }

  private createMetadata(metadata: Record<string, unknown> = {}) {
    return {
      ...metadata,
      service_name: this.config.serviceName,
      environment: this.config.environment,
      redaction_enabled: this.config.defaultRedaction ?? true,
    };
  }

  private headers() {
    return {
      authorization: `Bearer ${this.config.apiKey}`,
      "content-type": "application/json",
    };
  }
}

export function createOpenTelemetryHttpConfig(config: OpenStatClientConfig) {
  const endpoint = (config.endpoint ?? "http://localhost:4000").replace(/\/$/u, "");
  const headers = {
    authorization: `Bearer ${config.apiKey}`,
  };

  return {
    serviceName: config.serviceName,
    environment: config.environment,
    traces: {
      url: `${endpoint}/v1/traces`,
      headers,
    },
    logs: {
      url: `${endpoint}/v1/logs`,
      headers,
    },
    metrics: {
      url: `${endpoint}/v1/metrics`,
      headers,
    },
  };
}

async function parseResponse(response: Response) {
  const body = (await response.json().catch(() => undefined)) as unknown;

  if (!response.ok) {
    throw new OpenStatApiError(response.status, body);
  }

  return body;
}

function createId(prefix: string) {
  return `${prefix}_${globalThis.crypto.randomUUID()}`;
}

export class OpenStatApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`OpenStat API request failed with status ${status}.`);
    this.name = "OpenStatApiError";
  }
}
