"use client";

import { useState, useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Mono,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import type { Webhook } from "@/lib/gql";
import {
  createWebhookAction,
  deleteWebhookAction,
} from "@/app/(app)/settings/webhooks/actions";

const EVENTS = ["decision.denied"];

export function WebhooksManager({ webhooks }: { webhooks: Webhook[] }) {
  const [url, setUrl] = useState("");
  const [event, setEvent] = useState(EVENTS[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        await createWebhookAction(trimmed, event);
        setUrl("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create webhook");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        await deleteWebhookAction(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete webhook");
      }
    });
  }

  const inputCls =
    "rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none";

  return (
    <Card>
      <CardHeader
        title="Webhook endpoints"
        subtitle="Signed HMAC deliveries fire when a matching decision is recorded"
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${inputCls} min-w-64 flex-1`}
            placeholder="https://example.com/hooks/agentgate"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") create();
            }}
          />
          <select
            className={inputCls}
            value={event}
            onChange={(e) => setEvent(e.target.value)}
          >
            {EVENTS.map((ev) => (
              <option key={ev} value={ev}>
                {ev}
              </option>
            ))}
          </select>
          <Button onClick={create} disabled={pending || !url.trim()}>
            Add endpoint
          </Button>
        </div>
        {error ? <p className="text-xs text-rose-400">{error}</p> : null}

        {webhooks.length === 0 ? (
          <EmptyState
            title="No webhook endpoints"
            hint="Add a URL above to receive signed decision events in real time."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>URL</TH>
                <TH>Event</TH>
                <TH>Status</TH>
                <TH>Created</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {webhooks.map((w) => (
                <TR key={w.id}>
                  <TD className="text-zinc-200">
                    <Mono>{w.url}</Mono>
                  </TD>
                  <TD>
                    <Mono>{w.event}</Mono>
                  </TD>
                  <TD>
                    <Badge variant={w.enabled ? "allow" : "neutral"}>
                      {w.enabled ? "enabled" : "disabled"}
                    </Badge>
                  </TD>
                  <TD className="text-xs text-zinc-500">{formatDateTime(w.createdAt)}</TD>
                  <TD className="text-right">
                    <Button variant="danger" onClick={() => remove(w.id)} disabled={pending}>
                      Delete
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}
