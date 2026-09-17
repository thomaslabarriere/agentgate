import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { verifyAgent } from "@/lib/apikey";
import { decide } from "@/lib/policy/engine";
import { mapPoliciesToRules } from "@/lib/policy/adapter";
import { buildDeniedPayload, deliverDeniedWebhooks } from "@/lib/webhooks";

export const runtime = "nodejs";

const bodySchema = z.object({
  action: z.string().min(1),
  resource: z.string().min(1),
  context: z.record(z.string(), z.unknown()).optional(),
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: Request): Promise<Response> {
  // 1. Authenticate the agent by its bearer API key.
  const auth = request.headers.get("authorization") ?? "";
  const rawKey = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!rawKey) {
    return json({ error: "Missing bearer API key." }, 401);
  }
  const verified = await verifyAgent(rawKey);
  if (!verified) {
    return json({ error: "Unknown API key." }, 401);
  }

  // 2. Validate the request body.
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: "Invalid request.", issues: parsed.error.issues }, 422);
  }
  const { action, resource, context } = parsed.data;
  const orgId = verified.organizationId;

  // 3. Load the org's enabled policies -> engine rules -> verdict.
  const policies = await prisma.policy.findMany({
    where: { organizationId: orgId, enabled: true },
  });
  const rules = mapPoliciesToRules(policies);
  const decision = decide(rules, { action, resource });

  // 4. Persist the decision with its audit trail. Look up this agent's
  //    immediately-previous decision BEFORE inserting the new one, so we can
  //    link them as a temporal succession edge (from prev -> new).
  const prev = await prisma.decision.findFirst({
    where: { organizationId: orgId, agentId: verified.agent.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true },
  });

  const persisted = await prisma.decision.create({
    data: {
      organizationId: orgId,
      agentId: verified.agent.id,
      action,
      resource,
      granted: decision.granted,
      decidingPolicy: decision.decidingPolicy,
      applied: {
        applicable: decision.applicable,
        context: (context ?? {}) as Prisma.InputJsonValue,
      },
    },
    select: { id: true },
  });

  // Link the agent's previous decision to this one: an honest edge semantics of
  // same-agent temporal succession. Skip when there is no prior decision.
  if (prev) {
    await prisma.decisionEdge.create({
      data: { fromId: prev.id, toId: persisted.id, label: "succeeds" },
    });
  }

  // 5. On DENY, fire webhooks best-effort (never fail the request path).
  if (!decision.granted) {
    try {
      await deliverDeniedWebhooks(
        orgId,
        buildDeniedPayload({
          decisionId: persisted.id,
          organizationId: orgId,
          action,
          resource,
          decision,
        }),
      );
    } catch {
      // Delivery must never break ingestion.
    }
  }

  return json(
    {
      granted: decision.granted,
      decisionId: persisted.id,
      decidingPolicy: decision.decidingPolicy,
    },
    200,
  );
}
