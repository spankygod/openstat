"use client";

import { Button, Drawer, Tabs } from "@heroui/react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";

import type { DashboardInspectorData } from "../../lib/openstat-api";

export function DashboardInspector(props: {
  closeHref: string;
  inspector?: DashboardInspectorData;
}) {
  const router = useRouter();

  if (!props.inspector) {
    return null;
  }

  function closeInspector() {
    router.push(props.closeHref);
  }

  return (
    <Drawer.Backdrop
      className="dashboard-inspector-backdrop"
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          closeInspector();
        }
      }}
      variant="transparent"
    >
      <Drawer.Content className="dashboard-inspector-content" placement="right">
        <Drawer.Dialog
          aria-label={`${props.inspector.kind} inspector`}
          className="dashboard-inspector"
        >
          <Drawer.Header className="dashboard-inspector-header">
            <div>
              <p>{props.inspector.kind}</p>
              <Drawer.Heading>{props.inspector.title}</Drawer.Heading>
            </div>
            <Button
              aria-label="Close inspector"
              isIconOnly
              size="sm"
              variant="tertiary"
              onPress={closeInspector}
            >
              <X aria-hidden="true" size={16} />
            </Button>
          </Drawer.Header>

          <Drawer.Body className="dashboard-inspector-body">
            {props.inspector.errors.length > 0 ? (
              <div className="dashboard-inspector-error">
                {props.inspector.errors.join(" | ")}
              </div>
            ) : null}

            <Tabs
              className="dashboard-inspector-tabs"
              defaultSelectedKey="summary"
              variant="secondary"
            >
              <Tabs.ListContainer>
                <Tabs.List aria-label="Inspector sections">
                  <Tabs.Tab id="summary">
                    Summary
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab id="timeline">
                    Timeline
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab id="raw">
                    Raw
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab id="artifacts">
                    Artifacts
                    <Tabs.Indicator />
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>

              <Tabs.Panel className="dashboard-inspector-panel" id="summary">
                {props.inspector.summary.length > 0 ? (
                  <dl className="dashboard-inspector-summary">
                    {props.inspector.summary.map((item) => (
                      <div key={item.label}>
                        <dt>{item.label}</dt>
                        <dd>{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="dashboard-inspector-muted">
                    No structured summary is available for this item yet.
                  </p>
                )}
              </Tabs.Panel>

              <Tabs.Panel className="dashboard-inspector-panel" id="timeline">
                <InspectorTimeline data={props.inspector.data} />
              </Tabs.Panel>

              <Tabs.Panel className="dashboard-inspector-panel" id="raw">
                <pre className="dashboard-inspector-json">
                  {JSON.stringify(props.inspector.data, null, 2)}
                </pre>
              </Tabs.Panel>

              <Tabs.Panel className="dashboard-inspector-panel" id="artifacts">
                <InspectorArtifacts data={props.inspector.data} />
              </Tabs.Panel>
            </Tabs>
          </Drawer.Body>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}

function InspectorTimeline(props: { data: unknown }) {
  const events = getArrayFromUnknown(props.data, "events");
  const decisions = getArrayFromUnknown(props.data, "decisions");
  const fills = getArrayFromUnknown(props.data, "fills");
  const items = [...events, ...decisions, ...fills].slice(0, 20);

  if (items.length === 0) {
    return (
      <p className="dashboard-inspector-muted">
        No timeline rows are available for this detail yet.
      </p>
    );
  }

  return (
    <ol className="dashboard-inspector-timeline">
      {items.map((item, index) => {
        const record = asRecord(item);
        const label =
          record?.eventType ??
          record?.status ??
          record?.result ??
          record?.symbol ??
          `Step ${index + 1}`;
        const timestamp =
          record?.timestamp ??
          record?.createdAt ??
          record?.decidedAt ??
          record?.filledAt;

        return (
          <li key={`${String(label)}-${index}`}>
            <strong>{String(label)}</strong>
            {timestamp ? <span>{String(timestamp)}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

function InspectorArtifacts(props: { data: unknown }) {
  const artifacts = getArrayFromUnknown(props.data, "artifacts");

  if (artifacts.length === 0) {
    return (
      <p className="dashboard-inspector-muted">
        No artifacts are linked to this item yet.
      </p>
    );
  }

  return (
    <ul className="dashboard-inspector-artifacts">
      {artifacts.map((artifact, index) => {
        const record = asRecord(artifact);
        const label = record?.name ?? record?.type ?? record?.id ?? `Artifact ${index + 1}`;

        return <li key={`${String(label)}-${index}`}>{String(label)}</li>;
      })}
    </ul>
  );
}

function getArrayFromUnknown(value: unknown, key: string): Array<unknown> {
  const record = asRecord(value);
  const direct = record?.[key];

  if (Array.isArray(direct)) {
    return direct;
  }

  for (const child of Object.values(record ?? {})) {
    const childRecord = asRecord(child);
    const nested = childRecord?.[key];

    if (Array.isArray(nested)) {
      return nested;
    }
  }

  return [];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return undefined;
}
