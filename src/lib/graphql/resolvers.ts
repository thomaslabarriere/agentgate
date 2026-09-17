import { randomBytes } from "node:crypto";

import { GraphQLError, GraphQLScalarType, Kind } from "graphql";
import type { Effect as PrismaEffect, Role } from "@prisma/client";

import type { GraphQLContext } from "@/lib/graphql/context";
import type { Rule } from "@/lib/policy/engine";
import { generateApiKey } from "@/lib/apikey";
import { assertSafeWebhookUrl } from "@/lib/webhooks";

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested without a DB)
// ---------------------------------------------------------------------------

/** A Policy row as far as rule-mapping cares — the engine-relevant columns. */
export interface PolicyRow {
  id: string;
  action: string;
  resource: string;
  subtree: boolean;
  effect: PrismaEffect;
  priority: number;
  enabled: boolean;
}

/** Map persisted Policy rows to engine `Rule[]`. Pure; no verdict logic here. */
export function mapPoliciesToRules(policies: PolicyRow[]): Rule[] {
  return policies.map((p) => ({
    id: p.id,
    action: p.action,
    resource: p.resource,
    subtree: p.subtree,
    effect: p.effect, // Prisma Effect ("ALLOW"|"DENY") === engine Effect
    priority: p.priority,
    enabled: p.enabled,
  }));
}

const ROLE_RANK: Record<Role, number> = { MEMBER: 1, ADMIN: 2, OWNER: 3 };

/**
 * Authorize the caller. Throws when there is no active org, or when the
 * caller's role is below `min`. Pure over its inputs (role, min).
 */
export function assertRole(role: Role | null, min: Role): Role {
  if (role === null) {
    throw new GraphQLError("No active organization or membership.", {
      extensions: { code: "FORBIDDEN" },
    });
  }
  if (ROLE_RANK[role] < ROLE_RANK[min]) {
    throw new GraphQLError(`Requires ${min} role or higher.`, {
      extensions: { code: "FORBIDDEN" },
    });
  }
  return role;
}

// ---------------------------------------------------------------------------
// Scalars
// ---------------------------------------------------------------------------

const DateTimeScalar = new GraphQLScalarType({
  name: "DateTime",
  description: "ISO-8601 date-time string.",
  serialize(value) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string" || typeof value === "number") {
      return new Date(value).toISOString();
    }
    throw new GraphQLError("DateTime must serialize a Date, string, or number.");
  },
  parseValue(value) {
    if (typeof value === "string") return new Date(value);
    throw new GraphQLError("DateTime must be an ISO string.");
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) return new Date(ast.value);
    throw new GraphQLError("DateTime must be an ISO string.");
  },
});

const JSONScalar = new GraphQLScalarType({
  name: "JSON",
  description: "Arbitrary JSON value.",
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral(ast) {
    return parseJSONLiteral(ast);
  },
});

function parseJSONLiteral(ast: import("graphql").ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.NULL:
      return null;
    case Kind.LIST:
      return ast.values.map(parseJSONLiteral);
    case Kind.OBJECT: {
      const obj: Record<string, unknown> = {};
      for (const field of ast.fields) obj[field.name.value] = parseJSONLiteral(field.value);
      return obj;
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Resolver argument shapes
// ---------------------------------------------------------------------------

type AnalyticsRange = "DAY" | "WEEK" | "MONTH";

interface DecisionFilter {
  agentId?: string | null;
  granted?: boolean | null;
  action?: string | null;
  resource?: string | null;
}

interface UpsertPolicyInput {
  id?: string | null;
  name: string;
  action: string;
  resource: string;
  subtree?: boolean | null;
  effect: PrismaEffect;
  priority?: number | null;
  enabled?: boolean | null;
}

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function rangeSince(range: AnalyticsRange): Date {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const span = range === "DAY" ? day : range === "WEEK" ? 7 * day : 30 * day;
  return new Date(now - span);
}

/** The active org id or a thrown FORBIDDEN error. */
function orgId(ctx: GraphQLContext): string {
  if (!ctx.org) {
    throw new GraphQLError("No active organization.", { extensions: { code: "FORBIDDEN" } });
  }
  return ctx.org.id;
}

// ---------------------------------------------------------------------------
// Resolver map
// ---------------------------------------------------------------------------

export const resolvers = {
  DateTime: DateTimeScalar,
  JSON: JSONScalar,

  Query: {
    me: (_p: unknown, _a: unknown, ctx: GraphQLContext) => ctx.user,

    activeOrg: (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      if (!ctx.org) return null;
      return { ...ctx.org, role: ctx.role };
    },

    agents: (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      assertRole(ctx.role, "MEMBER");
      return ctx.prisma.agent.findMany({
        where: { organizationId: orgId(ctx) },
        orderBy: { createdAt: "desc" },
      });
    },

    policies: (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      assertRole(ctx.role, "MEMBER");
      return ctx.prisma.policy.findMany({
        where: { organizationId: orgId(ctx) },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      });
    },

    decisions: async (
      _p: unknown,
      args: { limit?: number | null; cursor?: string | null; filter?: DecisionFilter | null },
      ctx: GraphQLContext,
    ) => {
      assertRole(ctx.role, "MEMBER");
      const take = Math.min(Math.max(args.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
      const f = args.filter ?? {};
      const nodes = await ctx.prisma.decision.findMany({
        where: {
          organizationId: orgId(ctx),
          ...(f.agentId ? { agentId: f.agentId } : {}),
          ...(typeof f.granted === "boolean" ? { granted: f.granted } : {}),
          ...(f.action ? { action: f.action } : {}),
          ...(f.resource ? { resource: f.resource } : {}),
        },
        include: { agent: true },
        orderBy: { createdAt: "desc" },
        take: take + 1,
        ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
      });
      const hasMore = nodes.length > take;
      const page = hasMore ? nodes.slice(0, take) : nodes;
      return {
        nodes: page,
        nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
      };
    },

    decision: async (_p: unknown, args: { id: string }, ctx: GraphQLContext) => {
      assertRole(ctx.role, "MEMBER");
      const d = await ctx.prisma.decision.findFirst({
        where: { id: args.id, organizationId: orgId(ctx) },
        include: { agent: true, edgesFrom: true, edgesTo: true },
      });
      if (!d) return null;
      return {
        ...d,
        edges: [...d.edgesFrom, ...d.edgesTo],
      };
    },

    analytics: async (
      _p: unknown,
      args: { range?: AnalyticsRange | null },
      ctx: GraphQLContext,
    ) => {
      assertRole(ctx.role, "MEMBER");
      const range: AnalyticsRange = args.range ?? "WEEK";
      const where = { organizationId: orgId(ctx), createdAt: { gte: rangeSince(range) } };

      const [total, allowed, grouped, agents] = await Promise.all([
        ctx.prisma.decision.count({ where }),
        ctx.prisma.decision.count({ where: { ...where, granted: true } }),
        ctx.prisma.decision.groupBy({
          by: ["agentId", "granted"],
          where,
          _count: { _all: true },
        }),
        ctx.prisma.agent.findMany({
          where: { organizationId: orgId(ctx) },
          select: { id: true, name: true },
        }),
      ]);

      const denied = total - allowed;
      const nameById = new Map(agents.map((a) => [a.id, a.name]));
      const perAgentMap = new Map<string, { total: number; allowed: number; denied: number }>();
      for (const g of grouped) {
        const entry = perAgentMap.get(g.agentId) ?? { total: 0, allowed: 0, denied: 0 };
        const count = g._count._all;
        entry.total += count;
        if (g.granted) entry.allowed += count;
        else entry.denied += count;
        perAgentMap.set(g.agentId, entry);
      }
      const perAgent = [...perAgentMap.entries()].map(([agentId, v]) => ({
        agentId,
        agentName: nameById.get(agentId) ?? "(deleted)",
        total: v.total,
        allowed: v.allowed,
        denied: v.denied,
      }));

      return {
        range,
        total,
        allowed,
        denied,
        allowRate: total === 0 ? 0 : allowed / total,
        denyRate: total === 0 ? 0 : denied / total,
        perAgent,
      };
    },

    webhooks: (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      assertRole(ctx.role, "MEMBER");
      return ctx.prisma.webhookEndpoint.findMany({
        where: { organizationId: orgId(ctx) },
        orderBy: { createdAt: "desc" },
        select: { id: true, url: true, event: true, enabled: true, createdAt: true },
      });
    },

    subscription: (_p: unknown, _a: unknown, ctx: GraphQLContext) => {
      assertRole(ctx.role, "MEMBER");
      return ctx.prisma.subscription.findUnique({
        where: { organizationId: orgId(ctx) },
      });
    },
  },

  Mutation: {
    createAgent: async (_p: unknown, args: { name: string }, ctx: GraphQLContext) => {
      assertRole(ctx.role, "ADMIN");
      const key = generateApiKey();
      const agent = await ctx.prisma.agent.create({
        data: {
          name: args.name,
          organizationId: orgId(ctx),
          apiKeyHash: key.hash,
          apiKeyPrefix: key.prefix,
        },
      });
      return { agent, rawKey: key.raw };
    },

    revokeAgent: async (_p: unknown, args: { id: string }, ctx: GraphQLContext) => {
      assertRole(ctx.role, "ADMIN");
      const res = await ctx.prisma.agent.deleteMany({
        where: { id: args.id, organizationId: orgId(ctx) },
      });
      return res.count > 0;
    },

    upsertPolicy: async (
      _p: unknown,
      args: { input: UpsertPolicyInput },
      ctx: GraphQLContext,
    ) => {
      assertRole(ctx.role, "ADMIN");
      const org = orgId(ctx);
      const { input } = args;
      const data = {
        name: input.name,
        action: input.action,
        resource: input.resource,
        subtree: input.subtree ?? false,
        effect: input.effect,
        priority: input.priority ?? 0,
        enabled: input.enabled ?? true,
      };
      if (input.id) {
        const existing = await ctx.prisma.policy.findFirst({
          where: { id: input.id, organizationId: org },
          select: { id: true },
        });
        if (!existing) {
          throw new GraphQLError("Policy not found.", { extensions: { code: "NOT_FOUND" } });
        }
        return ctx.prisma.policy.update({ where: { id: input.id }, data });
      }
      return ctx.prisma.policy.create({ data: { ...data, organizationId: org } });
    },

    deletePolicy: async (_p: unknown, args: { id: string }, ctx: GraphQLContext) => {
      assertRole(ctx.role, "ADMIN");
      const res = await ctx.prisma.policy.deleteMany({
        where: { id: args.id, organizationId: orgId(ctx) },
      });
      return res.count > 0;
    },

    inviteMember: async (
      _p: unknown,
      args: { email: string; role: Role },
      ctx: GraphQLContext,
    ) => {
      assertRole(ctx.role, "OWNER");
      return ctx.prisma.invitation.create({
        data: { email: args.email, role: args.role, organizationId: orgId(ctx) },
      });
    },

    createWebhook: async (
      _p: unknown,
      args: { url: string; event?: string | null },
      ctx: GraphQLContext,
    ) => {
      assertRole(ctx.role, "ADMIN");
      // Reject a webhook URL that resolves to a non-public host at creation
      // time, not only at delivery, so a bad endpoint never gets stored.
      try {
        await assertSafeWebhookUrl(args.url);
      } catch (err) {
        throw new GraphQLError(err instanceof Error ? err.message : "invalid webhook url");
      }
      const created = await ctx.prisma.webhookEndpoint.create({
        data: {
          url: args.url,
          event: args.event ?? "decision.denied",
          secret: `whsec_${randomBytes(24).toString("hex")}`,
          organizationId: orgId(ctx),
        },
        select: { id: true, url: true, event: true, enabled: true, createdAt: true },
      });
      return created;
    },

    deleteWebhook: async (_p: unknown, args: { id: string }, ctx: GraphQLContext) => {
      assertRole(ctx.role, "ADMIN");
      const res = await ctx.prisma.webhookEndpoint.deleteMany({
        where: { id: args.id, organizationId: orgId(ctx) },
      });
      return res.count > 0;
    },
  },
};
