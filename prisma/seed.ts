/**
 * Demo seed for AgentGate. Idempotent and deterministic: re-running it converges
 * on the same demo org, agents, policy set, and a fresh batch of ~40 sample
 * decisions. Verdicts come from the real engine (`decide`), so seeded decisions
 * are always consistent with what the ingestion API would compute.
 *
 * Run with: npm run seed  (tsx prisma/seed.ts)
 */
import { PrismaClient, type Effect } from "@prisma/client";

import { hashApiKey } from "../src/lib/apikey";
import { mapPoliciesToRules, type PolicyRow } from "../src/lib/policy/adapter";
import { decide, type Rule } from "../src/lib/policy/engine";

const prisma = new PrismaClient();

const ORG_SLUG = "acme-robotics";
const ORG_NAME = "Acme Robotics";

// Deterministic raw agent keys so the seed is idempotent (stable hashes) and the
// demo can hit the ingestion API with a known Bearer token every run. The hash
// is derived with the app's own `hashApiKey`, exactly like a minted key.
interface SeedAgent {
  name: string;
  raw: string;
}
const AGENTS: SeedAgent[] = [
  { name: "refund-bot", raw: "ag_live_1111111111111111111111111111111a" },
  { name: "ops-runner", raw: "ag_live_2222222222222222222222222222222b" },
];

const PREFIX_LEN = 12;

// A realistic policy set. The engine resolves conflicts by
// priority > resource-specificity > deny-overrides, so the specific EU deny wins
// over the broad billing allow, and the classified deny (high priority) wins
// over the admin-all allow.
interface SeedPolicy {
  name: string;
  action: string;
  resource: string;
  subtree: boolean;
  effect: Effect;
  priority: number;
}
const POLICIES: SeedPolicy[] = [
  { name: "Allow refunds on billing", action: "refund", resource: "billing", subtree: true, effect: "ALLOW", priority: 0 },
  { name: "Deny refunds in the EU", action: "refund", resource: "billing.eu", subtree: true, effect: "DENY", priority: 0 },
  { name: "Admin can do anything", action: "*", resource: "*", subtree: true, effect: "ALLOW", priority: 0 },
  { name: "Deny classified resources", action: "*", resource: "classified", subtree: true, effect: "DENY", priority: 100 },
];

// Sample requests exercised against the policy set. A deterministic spread of
// allow and deny outcomes across actions and resources.
const SAMPLE_REQUESTS: ReadonlyArray<{ action: string; resource: string; amount: number }> = [
  { action: "refund", resource: "billing.us", amount: 120 },
  { action: "refund", resource: "billing.eu", amount: 900 },
  { action: "refund", resource: "billing.us.card", amount: 45 },
  { action: "refund", resource: "billing.eu.sepa", amount: 300 },
  { action: "read", resource: "billing.us", amount: 0 },
  { action: "export", resource: "classified.reports", amount: 0 },
  { action: "refund", resource: "billing", amount: 60 },
  { action: "deploy", resource: "infra.staging", amount: 0 },
];

async function main(): Promise<void> {
  // 1. Organization (upsert by unique slug).
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    update: { name: ORG_NAME },
    create: { name: ORG_NAME, slug: ORG_SLUG },
  });

  // 2. Agents (upsert by the unique apiKeyHash so re-runs do not duplicate).
  const agentIds: string[] = [];
  for (const a of AGENTS) {
    const apiKeyHash = hashApiKey(a.raw);
    const agent = await prisma.agent.upsert({
      where: { apiKeyHash },
      update: { name: a.name, organizationId: org.id },
      create: {
        name: a.name,
        organizationId: org.id,
        apiKeyHash,
        apiKeyPrefix: a.raw.slice(0, PREFIX_LEN),
      },
    });
    agentIds.push(agent.id);
  }

  // 3. Policies. Replace the org's policy set wholesale so the seed converges.
  await prisma.policy.deleteMany({ where: { organizationId: org.id } });
  const policyRows: PolicyRow[] = [];
  for (const p of POLICIES) {
    const created = await prisma.policy.create({
      data: {
        organizationId: org.id,
        name: p.name,
        action: p.action,
        resource: p.resource,
        subtree: p.subtree,
        effect: p.effect,
        priority: p.priority,
        enabled: true,
      },
    });
    policyRows.push(created);
  }
  const rules: Rule[] = mapPoliciesToRules(policyRows);

  // 4. Decisions. Clear the org's decisions (edges cascade) and regenerate ~40
  //    using the real engine so verdicts match ingestion.
  await prisma.decision.deleteMany({ where: { organizationId: org.id } });
  const decisionIds: string[] = [];
  // Track each agent's decisions in creation (time) order so we can link
  // consecutive ones as succession edges below.
  const byAgent = new Map<string, string[]>();
  const TARGET = 40;
  for (let i = 0; i < TARGET; i++) {
    const agentId = agentIds[i % agentIds.length];
    const sample = SAMPLE_REQUESTS[i % SAMPLE_REQUESTS.length];
    const decision = decide(rules, { action: sample.action, resource: sample.resource });
    const created = await prisma.decision.create({
      data: {
        organizationId: org.id,
        agentId,
        action: sample.action,
        resource: sample.resource,
        granted: decision.granted,
        decidingPolicy: decision.decidingPolicy,
        applied: {
          applicable: decision.applicable,
          context: { amount: sample.amount, seededIndex: i },
        },
      },
      select: { id: true },
    });
    decisionIds.push(created.id);
    const seq = byAgent.get(agentId) ?? [];
    seq.push(created.id);
    byAgent.set(agentId, seq);
  }

  // 5. Decision-graph edges: same-agent temporal succession. For each agent,
  //    link its consecutive decisions (prev -> next) in time order. This is the
  //    honest edge semantics the graph viz renders (see DECISIONS.md).
  for (const seq of byAgent.values()) {
    for (let i = 0; i + 1 < seq.length; i++) {
      await prisma.decisionEdge.create({
        data: { fromId: seq[i], toId: seq[i + 1], label: "succeeds" },
      });
    }
  }

  // 6. A FREE subscription for the demo org (upsert on the unique org id).
  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    update: {},
    create: { organizationId: org.id, plan: "FREE", status: "active" },
  });

  const [agentCount, policyCount, decisionCount, edgeTotal, grantedCount] = await Promise.all([
    prisma.agent.count({ where: { organizationId: org.id } }),
    prisma.policy.count({ where: { organizationId: org.id } }),
    prisma.decision.count({ where: { organizationId: org.id } }),
    prisma.decisionEdge.count({ where: { from: { organizationId: org.id } } }),
    prisma.decision.count({ where: { organizationId: org.id, granted: true } }),
  ]);

  console.log("AgentGate demo seed complete.");
  console.log(`  Organization: ${ORG_NAME} (${org.slug}) [${org.id}]`);
  console.log(`  Agents:    ${agentCount}`);
  for (const a of AGENTS) {
    console.log(`    - ${a.name}: ${a.raw}`);
  }
  console.log(`  Policies:  ${policyCount}`);
  console.log(`  Decisions: ${decisionCount} (${grantedCount} allow / ${decisionCount - grantedCount} deny)`);
  console.log(`  Edges:     ${edgeTotal}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
