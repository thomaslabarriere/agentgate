"use client";

import { useMemo, useState, useTransition } from "react";
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
import { variantForEffect, variantForGranted } from "@/components/ui/variants";
import { decide, type Rule } from "@/lib/policy/engine";
import type { Effect, Policy } from "@/lib/gql";
import {
  upsertPolicyAction,
  deletePolicyAction,
  type PolicyInput,
} from "@/app/(app)/policies/actions";

const EMPTY: PolicyInput = {
  name: "",
  action: "*",
  resource: "billing",
  subtree: true,
  effect: "ALLOW",
  priority: 0,
  enabled: true,
};

function toInput(p: Policy): PolicyInput {
  return {
    id: p.id,
    name: p.name,
    action: p.action,
    resource: p.resource,
    subtree: p.subtree,
    effect: p.effect,
    priority: p.priority,
    enabled: p.enabled,
  };
}

export function PolicyEditor({ policies }: { policies: Policy[] }) {
  const [draft, setDraft] = useState<PolicyInput>(EMPTY);
  const [sample, setSample] = useState({ action: "refund", resource: "billing.eu" });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(draft.id);

  // Live, clearly-labelled PREVIEW: recompute a verdict against the current
  // policy set with the draft applied. This is the ONE place the engine runs
  // in the browser; real verdicts always come from the ingestion API.
  const preview = useMemo(() => {
    const rules: Rule[] = policies
      .filter((p) => p.id !== draft.id)
      .map((p) => ({
        id: p.id,
        action: p.action,
        resource: p.resource,
        subtree: p.subtree,
        effect: p.effect,
        priority: p.priority,
        enabled: p.enabled,
      }));
    rules.push({
      id: draft.id ?? "draft",
      action: draft.action || "*",
      resource: draft.resource,
      subtree: draft.subtree,
      effect: draft.effect,
      priority: draft.priority,
      enabled: draft.enabled,
    });
    return decide(rules, { action: sample.action, resource: sample.resource });
  }, [policies, draft, sample]);

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await upsertPolicyAction(draft);
        setDraft(EMPTY);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save policy");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        await deletePolicyAction(id);
        if (draft.id === id) setDraft(EMPTY);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete policy");
      }
    });
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none";
  const labelCls = "mb-1 block text-xs font-medium text-zinc-400";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* List */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader title="Policies" subtitle="Evaluated by the engine, most specific / highest priority first" />
          {policies.length === 0 ? (
            <CardBody>
              <EmptyState
                title="No policies yet"
                hint="Add your first rule on the right. With no policy, the engine default-denies every action."
              />
            </CardBody>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Action</TH>
                  <TH>Resource</TH>
                  <TH>Effect</TH>
                  <TH>Prio</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {policies.map((p) => (
                  <TR key={p.id}>
                    <TD className="text-zinc-200">
                      {p.name}
                      {!p.enabled ? (
                        <span className="ml-2 text-xs text-zinc-600">disabled</span>
                      ) : null}
                    </TD>
                    <TD>
                      <Mono>{p.action}</Mono>
                    </TD>
                    <TD>
                      <Mono>
                        {p.resource}
                        {p.subtree ? ".*" : ""}
                      </Mono>
                    </TD>
                    <TD>
                      <Badge variant={variantForEffect(p.effect)}>{p.effect}</Badge>
                    </TD>
                    <TD className="tabular-nums text-zinc-400">{p.priority}</TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" onClick={() => setDraft(toInput(p))}>
                          Edit
                        </Button>
                        <Button variant="ghost" onClick={() => remove(p.id)} disabled={pending}>
                          Delete
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>

      {/* Editor + preview */}
      <div className="space-y-6">
        <Card>
          <CardHeader title={isEditing ? "Edit policy" : "New policy"} />
          <CardBody className="space-y-3">
            <div>
              <label className={labelCls}>Name</label>
              <input
                className={inputCls}
                value={draft.name}
                placeholder="Allow EU refunds"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Action</label>
                <input
                  className={inputCls}
                  value={draft.action}
                  placeholder="refund or *"
                  onChange={(e) => setDraft({ ...draft, action: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Resource</label>
                <input
                  className={inputCls}
                  value={draft.resource}
                  placeholder="billing.eu"
                  onChange={(e) => setDraft({ ...draft, resource: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Effect</label>
                <select
                  className={inputCls}
                  value={draft.effect}
                  onChange={(e) => setDraft({ ...draft, effect: e.target.value as Effect })}
                >
                  <option value="ALLOW">ALLOW</option>
                  <option value="DENY">DENY</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Priority</label>
                <input
                  type="number"
                  className={inputCls}
                  value={draft.priority}
                  onChange={(e) =>
                    setDraft({ ...draft, priority: Number(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-4 pt-1">
              <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={draft.subtree}
                  onChange={(e) => setDraft({ ...draft, subtree: e.target.checked })}
                />
                Subtree
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
                />
                Enabled
              </label>
            </div>
            {error ? <p className="text-xs text-rose-400">{error}</p> : null}
            <div className="flex gap-2 pt-1">
              <Button onClick={save} disabled={pending || !draft.name}>
                {isEditing ? "Save changes" : "Create policy"}
              </Button>
              {isEditing ? (
                <Button variant="ghost" onClick={() => setDraft(EMPTY)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Preview" subtitle="Runs the engine in-browser — not a recorded decision" />
          <CardBody className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Sample action</label>
                <input
                  className={inputCls}
                  value={sample.action}
                  onChange={(e) => setSample({ ...sample, action: e.target.value })}
                />
              </div>
              <div>
                <label className={labelCls}>Sample resource</label>
                <input
                  className={inputCls}
                  value={sample.resource}
                  onChange={(e) => setSample({ ...sample, resource: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={variantForGranted(preview.granted)}>
                {preview.granted ? "ALLOW" : "DENY"}
              </Badge>
              <span className="text-xs text-zinc-500">
                {preview.decidingPolicy
                  ? `decided by ${preview.decidingPolicy === draft.id || preview.decidingPolicy === "draft" ? "this policy" : preview.decidingPolicy}`
                  : "default deny — no rule matched"}
              </span>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
