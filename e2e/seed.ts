/**
 * Throwaway seed for the e2e ingestion tests. Creates a dedicated org + agent +
 * a minimal allow/deny policy set, idempotently, and returns the agent's raw API
 * key so the test can call the real ingestion API with a valid Bearer token.
 *
 * This runs in Node (Playwright's test process), against the same DATABASE_URL
 * the app under test uses, so a decision the API persists is the one the engine
 * computed from these policies.
 */
import { PrismaClient, type Effect } from "@prisma/client";

import { hashApiKey } from "../src/lib/apikey";

const E2E_ORG_SLUG = "e2e-ingestion";
const E2E_ORG_NAME = "E2E Ingestion Org";
// Deterministic raw key so re-runs converge and the test knows the token.
const E2E_AGENT_KEY = "ag_live_e2e00000000000000000000000000000e";

export interface E2ESeed {
  agentKey: string;
  allowCase: { action: string; resource: string };
  denyCase: { action: string; resource: string };
}

interface PolicySeed {
  name: string;
  action: string;
  resource: string;
  subtree: boolean;
  effect: Effect;
  priority: number;
}

const POLICIES: PolicySeed[] = [
  { name: "Allow refunds on billing", action: "refund", resource: "billing", subtree: true, effect: "ALLOW", priority: 0 },
  { name: "Deny refunds in the EU", action: "refund", resource: "billing.eu", subtree: true, effect: "DENY", priority: 0 },
];

export async function seedE2E(): Promise<E2ESeed> {
  const prisma = new PrismaClient();
  try {
    const org = await prisma.organization.upsert({
      where: { slug: E2E_ORG_SLUG },
      update: { name: E2E_ORG_NAME },
      create: { name: E2E_ORG_NAME, slug: E2E_ORG_SLUG },
    });

    const apiKeyHash = hashApiKey(E2E_AGENT_KEY);
    await prisma.agent.upsert({
      where: { apiKeyHash },
      update: { name: "e2e-agent", organizationId: org.id },
      create: {
        name: "e2e-agent",
        organizationId: org.id,
        apiKeyHash,
        apiKeyPrefix: E2E_AGENT_KEY.slice(0, 12),
      },
    });

    await prisma.policy.deleteMany({ where: { organizationId: org.id } });
    for (const p of POLICIES) {
      await prisma.policy.create({ data: { organizationId: org.id, enabled: true, ...p } });
    }

    return {
      agentKey: E2E_AGENT_KEY,
      // Covered by the billing ALLOW, no more-specific deny.
      allowCase: { action: "refund", resource: "billing.us" },
      // The billing.eu DENY is more specific than the billing ALLOW.
      denyCase: { action: "refund", resource: "billing.eu" },
    };
  } finally {
    await prisma.$disconnect();
  }
}
