/**
 * Prisma-backed resolver tests against the real local Postgres. These prove the
 * behaviours a mock cannot: that cursor pagination over a non-unique `createdAt`
 * returns the FULL set with no dupes/gaps (the bug this pass fixes), that the
 * analytics math is correct, and that a second org's rows never leak across the
 * tenant boundary. Everything created here is namespaced to throwaway orgs and
 * cleaned up in `afterAll`, so re-runs converge and leave no residue.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { resolvers } from "@/lib/graphql/resolvers";
import type { GraphQLContext } from "@/lib/graphql/context";
import type { Organization } from "@prisma/client";

const SLUG_A = "test-resolvers-org-a";
const SLUG_B = "test-resolvers-org-b";
const SLUG_EMPTY = "test-resolvers-org-empty";

// The decisions query/resolvers only touch ctx.role, ctx.org.id and ctx.prisma.
function ctxFor(org: Pick<Organization, "id">): GraphQLContext {
  return {
    user: null,
    org: { id: org.id } as Organization,
    role: "MEMBER",
    prisma,
  };
}

interface DecisionsResult {
  nodes: { id: string }[];
  nextCursor: string | null;
}

async function makeOrgWithAgent(slug: string) {
  const org = await prisma.organization.create({ data: { name: slug, slug } });
  const agent = await prisma.agent.create({
    data: {
      name: `${slug}-agent`,
      organizationId: org.id,
      apiKeyHash: `hash-${slug}`,
      apiKeyPrefix: "ag_test_",
    },
  });
  return { org, agent };
}

let orgAId: string;
let orgBId: string;
let orgEmptyId: string;
let agentAId: string;

// All of org A's decisions share this exact timestamp, so `createdAt` alone is a
// non-unique order and the id tie-break is the only thing preventing dup/drop.
// "now" so the rows fall inside the analytics MONTH window, yet identical for
// every row so createdAt alone is a non-unique order.
const SHARED_TS = new Date();
const A_TOTAL = 25;
const A_ALLOWED = 10; // first 10 granted, remaining 15 denied
const B_TOTAL = 5;

beforeAll(async () => {
  // Clean any residue from a previous aborted run.
  await prisma.organization.deleteMany({ where: { slug: { in: [SLUG_A, SLUG_B, SLUG_EMPTY] } } });

  const a = await makeOrgWithAgent(SLUG_A);
  orgAId = a.org.id;
  agentAId = a.agent.id;
  const b = await makeOrgWithAgent(SLUG_B);
  orgBId = b.org.id;
  const empty = await prisma.organization.create({ data: { name: SLUG_EMPTY, slug: SLUG_EMPTY } });
  orgEmptyId = empty.id;

  await prisma.decision.createMany({
    data: Array.from({ length: A_TOTAL }, (_v, i) => ({
      organizationId: orgAId,
      agentId: agentAId,
      action: "refund",
      resource: "billing",
      granted: i < A_ALLOWED,
      decidingPolicy: null,
      applied: { applicable: [], context: {} },
      createdAt: SHARED_TS, // identical for every row: the dup/drop trap
    })),
  });

  await prisma.decision.createMany({
    data: Array.from({ length: B_TOTAL }, () => ({
      organizationId: orgBId,
      agentId: b.agent.id,
      action: "read",
      resource: "billing",
      granted: true,
      decidingPolicy: null,
      applied: { applicable: [], context: {} },
      createdAt: SHARED_TS,
    })),
  });
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { slug: { in: [SLUG_A, SLUG_B, SLUG_EMPTY] } } });
  await prisma.$disconnect();
});

async function pageAll(orgId: string, limit: number): Promise<string[]> {
  const ctx = ctxFor({ id: orgId });
  const seen: string[] = [];
  let cursor: string | null = null;
  // Bounded loop so a pagination bug cannot spin forever.
  for (let guard = 0; guard < 100; guard++) {
    const page: DecisionsResult = await resolvers.Query.decisions({}, { limit, cursor }, ctx);
    seen.push(...page.nodes.map((n) => n.id));
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return seen;
}

describe("decisions cursor pagination (Prisma-backed)", () => {
  it("pages the full set across ties with no dupes and no gaps", async () => {
    const ids = await pageAll(orgAId, 7); // 7 does not divide 25: forces a partial last page
    expect(ids).toHaveLength(A_TOTAL); // no drops
    expect(new Set(ids).size).toBe(A_TOTAL); // no dupes

    const truth = await prisma.decision.findMany({
      where: { organizationId: orgAId },
      select: { id: true },
    });
    expect(new Set(ids)).toEqual(new Set(truth.map((d) => d.id))); // exactly the org's rows
  });

  it("is stable across different page sizes", async () => {
    const byOne = new Set(await pageAll(orgAId, 1));
    const byBig = new Set(await pageAll(orgAId, 100));
    expect(byOne.size).toBe(A_TOTAL);
    expect(byOne).toEqual(byBig);
  });
});

describe("cross-tenant isolation", () => {
  it("never returns another org's decisions", async () => {
    const bIds = new Set(
      (await prisma.decision.findMany({ where: { organizationId: orgBId }, select: { id: true } })).map(
        (d) => d.id,
      ),
    );
    const aIds = await pageAll(orgAId, 7);
    for (const id of aIds) expect(bIds.has(id)).toBe(false);
    expect(aIds).toHaveLength(A_TOTAL);
  });
});

describe("analytics math", () => {
  it("computes counts and rates, with denied = total - allowed", async () => {
    const res = await resolvers.Query.analytics({}, { range: "MONTH" }, ctxFor({ id: orgAId }));
    expect(res.total).toBe(A_TOTAL);
    expect(res.allowed).toBe(A_ALLOWED);
    expect(res.denied).toBe(A_TOTAL - A_ALLOWED);
    expect(res.allowRate).toBeCloseTo(A_ALLOWED / A_TOTAL);
    expect(res.denyRate).toBeCloseTo((A_TOTAL - A_ALLOWED) / A_TOTAL);
  });

  it("guards against divide-by-zero for an org with no decisions", async () => {
    const res = await resolvers.Query.analytics({}, { range: "MONTH" }, ctxFor({ id: orgEmptyId }));
    expect(res.total).toBe(0);
    expect(res.allowRate).toBe(0);
    expect(res.denyRate).toBe(0);
    expect(res.perAgent).toEqual([]);
  });
});
