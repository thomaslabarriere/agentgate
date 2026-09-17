"use client";

import { useState, useTransition } from "react";
import {
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
import type { Agent } from "@/lib/gql";
import { createAgentAction, revokeAgentAction } from "@/app/(app)/agents/actions";

export function AgentsManager({ agents }: { agents: Agent[] }) {
  const [name, setName] = useState("");
  const [revealed, setRevealed] = useState<{ name: string; key: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        const created = await createAgentAction(trimmed);
        setRevealed({ name: created.agent.name, key: created.rawKey });
        setName("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create agent");
      }
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      try {
        await revokeAgentAction(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to revoke agent");
      }
    });
  }

  const inputCls =
    "rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none";

  return (
    <div className="space-y-6">
      {/* One-time key reveal */}
      {revealed ? (
        <Card className="border-indigo-500/40 bg-indigo-500/5">
          <CardBody>
            <p className="text-sm font-medium text-zinc-100">
              API key for “{revealed.name}”
            </p>
            <p className="mt-1 text-xs text-amber-300">
              Copy it now — this is the only time it will be shown.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-emerald-300">
                {revealed.key}
              </code>
              <Button
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard?.writeText(revealed.key);
                }}
              >
                Copy
              </Button>
              <Button variant="ghost" onClick={() => setRevealed(null)}>
                Done
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Agents"
          subtitle="Each agent authenticates to the ingestion API with its own key"
          action={
            <div className="flex items-center gap-2">
              <input
                className={inputCls}
                placeholder="New agent name…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") create();
                }}
              />
              <Button onClick={create} disabled={pending || !name.trim()}>
                New agent
              </Button>
            </div>
          }
        />
        {error ? <p className="px-5 pt-3 text-xs text-rose-400">{error}</p> : null}
        {agents.length === 0 ? (
          <CardBody>
            <EmptyState
              title="No agents yet"
              hint="Create an agent to get an API key, then point your service at POST /api/v1/decisions."
            />
          </CardBody>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Key</TH>
                <TH>Created</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {agents.map((a) => (
                <TR key={a.id}>
                  <TD className="text-zinc-200">{a.name}</TD>
                  <TD>
                    <Mono>{a.apiKeyPrefix}…</Mono>
                  </TD>
                  <TD className="text-xs text-zinc-500">{formatDateTime(a.createdAt)}</TD>
                  <TD className="text-right">
                    <Button variant="danger" onClick={() => revoke(a.id)} disabled={pending}>
                      Revoke
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
