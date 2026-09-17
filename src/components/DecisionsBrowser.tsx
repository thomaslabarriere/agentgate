"use client";

import { useState, useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Mono,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { variantForGranted } from "@/components/ui/variants";
import { formatDateTime } from "@/lib/format";
import type {
  Agent,
  Decision,
  DecisionDetail,
  DecisionFilter,
} from "@/lib/gql";
import { fetchDecisions, fetchDecisionDetail } from "@/app/(app)/decisions/actions";

const VERDICTS: { label: string; granted: boolean | undefined }[] = [
  { label: "All", granted: undefined },
  { label: "ALLOW", granted: true },
  { label: "DENY", granted: false },
];

export function DecisionsBrowser({
  initialItems,
  initialCursor,
  agents,
}: {
  initialItems: Decision[];
  initialCursor: string | null;
  agents: Agent[];
}) {
  const [items, setItems] = useState<Decision[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [filter, setFilter] = useState<DecisionFilter>({});
  const [selected, setSelected] = useState<DecisionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [pending, startTransition] = useTransition();

  function applyFilter(next: DecisionFilter) {
    setFilter(next);
    startTransition(async () => {
      const page = await fetchDecisions(next, null);
      setItems(page.nodes);
      setCursor(page.nextCursor);
    });
  }

  function loadMore() {
    startTransition(async () => {
      const page = await fetchDecisions(filter, cursor);
      setItems((prev) => [...prev, ...page.nodes]);
      setCursor(page.nextCursor);
    });
  }

  async function openDrawer(id: string) {
    setLoadingDetail(true);
    setSelected(null);
    try {
      const detail = await fetchDecisionDetail(id);
      setSelected(detail);
    } finally {
      setLoadingDetail(false);
    }
  }

  const inputCls =
    "rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none";

  return (
    <>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          className={inputCls}
          value={filter.agentId ?? ""}
          onChange={(e) => applyFilter({ ...filter, agentId: e.target.value || undefined })}
        >
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <input
          className={inputCls}
          placeholder="Action…"
          defaultValue={filter.action ?? ""}
          onBlur={(e) => applyFilter({ ...filter, action: e.target.value || undefined })}
        />
        <input
          className={inputCls}
          placeholder="Resource…"
          defaultValue={filter.resource ?? ""}
          onBlur={(e) => applyFilter({ ...filter, resource: e.target.value || undefined })}
        />
        <div className="flex overflow-hidden rounded-lg border border-zinc-700">
          {VERDICTS.map((v) => {
            const active = filter.granted === v.granted;
            return (
              <button
                key={v.label}
                type="button"
                onClick={() => applyFilter({ ...filter, granted: v.granted })}
                className={
                  active
                    ? "bg-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-100"
                    : "px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800"
                }
              >
                {v.label}
              </button>
            );
          })}
        </div>
        {pending ? <span className="text-xs text-zinc-500">Loading…</span> : null}
      </div>

      <Card>
        {items.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No decisions match"
              hint="Try clearing a filter, or send an action to the ingestion API."
            />
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Agent</TH>
                <TH>Action</TH>
                <TH>Resource</TH>
                <TH>Verdict</TH>
                <TH className="text-right">Time</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((d) => (
                <TR key={d.id} onClick={() => openDrawer(d.id)}>
                  <TD className="text-zinc-200">{d.agent?.name ?? "—"}</TD>
                  <TD>
                    <Mono>{d.action}</Mono>
                  </TD>
                  <TD>
                    <Mono>{d.resource}</Mono>
                  </TD>
                  <TD>
                    <Badge variant={variantForGranted(d.granted)}>
                      {d.granted ? "ALLOW" : "DENY"}
                    </Badge>
                  </TD>
                  <TD className="text-right text-xs text-zinc-500">
                    {formatDateTime(d.createdAt)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {cursor ? (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={loadMore} disabled={pending}>
            Load more
          </Button>
        </div>
      ) : null}

      {/* Audit drawer */}
      {loadingDetail || selected ? (
        <AuditDrawer
          detail={selected}
          loading={loadingDetail}
          onClose={() => {
            setSelected(null);
            setLoadingDetail(false);
          }}
        />
      ) : null}
    </>
  );
}

function AuditDrawer({
  detail,
  loading,
  onClose,
}: {
  detail: DecisionDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative z-50 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-950 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-100">Decision audit</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          >
            ✕
          </button>
        </div>

        {loading || !detail ? (
          <div className="p-5 text-sm text-zinc-500">Loading audit trail…</div>
        ) : (
          <div className="space-y-6 p-5">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Badge variant={variantForGranted(detail.granted)}>
                  {detail.granted ? "ALLOW" : "DENY"}
                </Badge>
                <span className="text-xs text-zinc-500">
                  {formatDateTime(detail.createdAt)}
                </span>
              </div>
              <p className="text-sm text-zinc-300">
                <span className="text-zinc-500">Agent</span> {detail.agent?.name ?? "—"}
              </p>
              <p className="mt-1 text-sm text-zinc-300">
                <Mono>{detail.action}</Mono> on <Mono>{detail.resource}</Mono>
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Deciding policy
              </h3>
              {detail.decidingPolicy ? (
                <p className="text-sm text-zinc-200">
                  <Mono>{detail.decidingPolicy}</Mono>
                </p>
              ) : (
                <p className="text-sm text-zinc-400">
                  Default deny — no policy matched this request.
                </p>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Applicable policies (evaluation order)
              </h3>
              {detail.applied.applicable.length === 0 ? (
                <p className="text-sm text-zinc-400">None matched.</p>
              ) : (
                <ol className="space-y-1">
                  {detail.applied.applicable.map((id, i) => (
                    <li
                      key={id}
                      className={
                        id === detail.decidingPolicy
                          ? "flex items-center gap-2 rounded-md bg-indigo-500/10 px-2 py-1 text-sm ring-1 ring-inset ring-indigo-500/30"
                          : "flex items-center gap-2 px-2 py-1 text-sm"
                      }
                    >
                      <span className="w-5 text-right text-xs text-zinc-600">{i + 1}.</span>
                      <Mono>{id}</Mono>
                      {id === detail.decidingPolicy ? (
                        <span className="text-xs text-indigo-300">decided</span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Request context
              </h3>
              <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 font-mono text-xs text-zinc-300">
                {JSON.stringify(detail.applied.context, null, 2)}
              </pre>
            </div>

            {detail.edges.length > 0 ? (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Graph edges
                </h3>
                <ul className="space-y-1 text-sm text-zinc-400">
                  {detail.edges.map((e) => (
                    <li key={e.id}>
                      <Mono>{e.label}</Mono> → <Mono>{e.toId}</Mono>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
