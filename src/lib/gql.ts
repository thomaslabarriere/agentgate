/**
 * A tiny typed GraphQL client for the console.
 *
 * The console only ever reads and writes through the GraphQL API at
 * `/api/graphql`. This runs on the SERVER (React Server Components and Server
 * Actions): it builds an absolute URL from `NEXT_PUBLIC_APP_URL` and forwards
 * the caller's session cookies so every resolver can authorize against the
 * active org. It never runs in the browser.
 */
import "server-only";
import { cookies } from "next/headers";
import type { Effect } from "@/lib/policy/engine";

// ---------------------------------------------------------------------------
// Domain types (mirror the GraphQL contract / Prisma model)
// ---------------------------------------------------------------------------

export type { Effect };

export interface Viewer {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export type Plan = "FREE" | "PRO";
export type Role = "OWNER" | "ADMIN" | "MEMBER";

export interface Org {
  id: string;
  name: string;
  slug: string;
  role: Role;
}

export interface Agent {
  id: string;
  name: string;
  apiKeyPrefix: string;
  createdAt: string;
}

/** Returned exactly once by `createAgent` — the raw key is never persisted. */
export interface CreatedAgent {
  agent: Agent;
  rawKey: string;
}

export interface Policy {
  id: string;
  name: string;
  action: string;
  resource: string;
  subtree: boolean;
  effect: Effect;
  priority: number;
  enabled: boolean;
  createdAt: string;
}

export interface DecisionAgentRef {
  id: string;
  name: string;
}

export interface Decision {
  id: string;
  action: string;
  resource: string;
  granted: boolean;
  decidingPolicy: string | null;
  createdAt: string;
  agent: DecisionAgentRef | null;
}

/** The audit trail persisted with each decision (the "why"), the `applied` JSON. */
export interface DecisionAudit {
  applicable: string[]; // ordered applicable policy ids, best-first
  context: Record<string, unknown>; // the request context the agent supplied
}

export interface DecisionEdge {
  id: string;
  fromId: string;
  toId: string;
  label: string;
}

export interface DecisionDetail extends Decision {
  applied: DecisionAudit;
  edges: DecisionEdge[];
}

export interface DecisionPage {
  nodes: Decision[];
  nextCursor: string | null;
}

/** The decision graph: recent decisions and the succession edges among them. */
export interface DecisionGraphData {
  nodes: Decision[];
  edges: DecisionEdge[];
}

export interface AgentBreakdown {
  agentId: string;
  agentName: string;
  total: number;
  allowed: number;
  denied: number;
}

/** A per-day allow/deny bucket used to draw the sparkline. */
export interface AnalyticsPoint {
  date: string; // ISO day
  allow: number;
  deny: number;
}

export interface Analytics {
  total: number;
  allowed: number;
  denied: number;
  allowRate: number; // 0..1
  perAgent: AgentBreakdown[];
}

export interface Webhook {
  id: string;
  url: string;
  event: string;
  enabled: boolean;
  createdAt: string;
}

export interface Subscription {
  plan: Plan;
  status: string;
}

// Filters (pure) live in `@/lib/filters` so they can be tested and imported on
// the client without pulling in this server-only module.
export { buildDecisionsQueryString } from "@/lib/filters";
export type { DecisionFilter } from "@/lib/filters";

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class GqlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GqlError";
  }
}

interface GqlResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

function endpoint(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/graphql`;
}

/**
 * Execute a GraphQL operation against the console API. Throws `GqlError` on a
 * transport or GraphQL error; callers in RSC pages wrap this in try/catch and
 * degrade to an `EmptyState` rather than crashing the render.
 */
export async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const cookieStore = await cookies();
  const res = await fetch(endpoint(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieStore.toString(),
    },
    body: JSON.stringify({ query, variables: variables ?? {} }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new GqlError(`GraphQL request failed with status ${res.status}`);
  }

  const json = (await res.json()) as GqlResponse<T>;
  if (json.errors && json.errors.length > 0) {
    throw new GqlError(json.errors.map((e) => e.message).join("; "));
  }
  if (json.data === undefined) {
    throw new GqlError("GraphQL response contained no data");
  }
  return json.data;
}
