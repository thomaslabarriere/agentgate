# AgentGate build contract

AgentGate is a multi-tenant developer console for governing and auditing AI-agent
actions. An agent's action is POSTed to an ingestion API; the policy engine
decides allow/deny; the decision and its audit trail are stored and shown in a
console (decisions browser, policy editor, decision graph, analytics). Mirrors
Rippletide's domain (decision infrastructure / agent governance / auditability).

This file is the single source of truth shared by every build slice. Conform to
it exactly; do not redefine what is listed as already-built.

## Already built (do NOT rewrite)
- `prisma/schema.prisma` — the data model (Organization, User, Membership(Role),
  Invitation, Agent, Policy(Effect), Decision, DecisionEdge, WebhookEndpoint,
  Subscription(Plan), + Auth.js tables). Postgres.
- `src/lib/policy/engine.ts` — the PURE policy engine + its `engine.test.ts`
  (13 tests, green). `decide(rules, {action, resource}) -> {granted,
  decidingPolicy, applicable}`. Default-deny; priority > resource-specificity >
  deny-overrides > id. Import Rule/Decision types from here; never reimplement.
- `src/lib/db.ts` — the shared `prisma` client singleton.
- `.env.example` — the env vars.

## Stack (fixed)
Next.js (App Router) + TypeScript strict · Auth.js v5 (`next-auth@beta`) with the
GitHub provider + `@auth/prisma-adapter` · Prisma + PostgreSQL · GraphQL via
`graphql-yoga` at `/api/graphql` · REST ingestion under `/api/v1` · `reactflow`
for the decision graph · Tailwind · Stripe (test mode) · Vitest (unit) +
Playwright (e2e) · GitHub Actions · deploy Vercel + Neon Postgres.

## Directory ownership (slices must not touch each other's dirs)
- **Auth & tenancy**: `src/auth.ts`, `src/lib/auth.ts` (session + `requireRole`),
  `src/middleware.ts`, `app/api/auth/*`, `app/(marketing)` sign-in, org create /
  switch / members / invitations pages + their server actions.
- **APIs & data**: `app/api/v1/decisions/route.ts` (REST, agent API-key auth),
  `app/api/graphql/route.ts` + `src/lib/graphql/*` (schema + resolvers),
  `src/lib/apikey.ts` (generate/verify), `src/lib/webhooks.ts` (signed delivery).
- **Console UI**: `app/(app)/*` pages + `src/components/*` (dashboard, decisions
  browser + audit drawer, policy editor, decision-graph viz, analytics). Reads
  data only through the GraphQL API below.
- **Billing / CI / e2e**: `src/lib/stripe.ts`, `app/api/stripe/*`, billing UI,
  `prisma/seed.ts`, `.github/workflows/ci.yml`, `playwright.config.ts`, `e2e/*`.

## Shared session contract (auth slice provides, others consume)
- `auth()` (from `src/auth.ts`) returns the Auth.js session (`session.user.id`).
- `src/lib/auth.ts` exports:
  - `getCurrentUser()` -> user or null.
  - `getActiveOrg()` -> the caller's current Organization (from a cookie
    `org` set on switch) or their first membership; null if none.
  - `requireRole(orgId, min: Role)` -> throws/redirects if the current user's
    membership role is below `min` (OWNER > ADMIN > MEMBER).
  All server code that touches org-scoped data MUST go through `getActiveOrg()`
  and `requireRole` so tenancy isolation is enforced in one place.

## REST ingestion contract
`POST /api/v1/decisions` with header `Authorization: Bearer <agent api key>`:
```json
{ "action": "refund", "resource": "billing.eu", "context": { "amount": 900 } }
```
- Resolve the Agent by API-key hash (`src/lib/apikey.ts`); 401 if unknown.
- Load the org's enabled policies, map to engine `Rule[]`, call `decide`.
- Persist a `Decision` (granted, decidingPolicy, `applied` = the audit JSON:
  ordered applicable rule ids + the request context). On a DENY, fire enabled
  `decision.denied` webhooks (`src/lib/webhooks.ts`, HMAC-signed).
- Respond `{ "granted": bool, "decisionId": string, "decidingPolicy": string|null }`.

## GraphQL contract (console reads/writes here; all org-scoped via session)
Queries: `me`, `activeOrg`, `agents`, `policies`, `decisions(limit,cursor,filter)`,
`decision(id)` (with audit + graph edges), `analytics(range)` (counts, allow/deny
rate, per-agent), `webhooks`, `subscription`.
Mutations: `createAgent(name)` -> returns the raw key ONCE; `revokeAgent(id)`;
`upsertPolicy(input)`; `deletePolicy(id)`; `inviteMember(email, role)`;
`createWebhook(url,event)`; `deleteWebhook(id)`.
Every resolver authorizes with the session + active org; MEMBER can read, ADMIN+
can mutate policies/agents, OWNER can manage members/billing.

## Non-negotiables
Strict TS (no `any` leaks), `next lint` clean, all fs/db access tenant-scoped,
the policy verdict always from `engine.decide` (never recomputed in the UI),
secrets only from env, deterministic tests offline (mock Prisma / the GraphQL
layer in unit tests; Playwright e2e runs against a seeded local DB).
