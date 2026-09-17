# AgentGate

AgentGate is a multi-tenant developer console for governing and auditing the
actions AI agents take. An agent asks permission for an action by calling one
ingestion API; a policy engine decides allow or deny; the decision and its full
audit trail are stored and shown in a console with a decisions browser, policy
editor, decision graph, and analytics. It mirrors the decision-infrastructure /
agent-governance / auditability domain.

## What it does

- Gate every agent action through a single decision API instead of scattering
  authorization logic across agents.
- Decide allow/deny with a pure, default-deny policy engine whose verdict is the
  single source of truth (never recomputed in the UI).
- Keep a complete, queryable audit log of every decision, including which policy
  decided and the request context.
- Isolate every organization's agents, policies, and decisions, with role-based
  access (OWNER, ADMIN, MEMBER).

## Architecture

```
agent
  |  POST /api/v1/decisions   (Authorization: Bearer <agent api key>)
  v
REST ingestion (src/app/api/v1/decisions)
  |  resolve agent by API-key hash -> load org's enabled policies
  v
policy engine (src/lib/policy/engine.ts, pure decide())
  |  verdict: granted / decidingPolicy / applicable rule ids
  v
Postgres audit (Prisma: Decision + DecisionEdge)
  |
  +--> on DENY: signed decision.denied webhook (HMAC)
  |
  v
GraphQL API (/api/graphql, graphql-yoga, all org-scoped)
  |
  v
React console (Next.js App Router): dashboard, decisions browser + audit
drawer, policy editor, decision-graph viz, analytics
```

The console reads and writes only through the GraphQL API; the ingestion path is
REST with agent API-key auth. Both share the same policy engine and Prisma
models, so a decision shown in the console is exactly what the engine computed.

## Stack

- Next.js (App Router) + TypeScript (strict)
- Auth.js v5 (`next-auth@beta`) with the GitHub provider + `@auth/prisma-adapter`
- Prisma + PostgreSQL
- GraphQL via `graphql-yoga` at `/api/graphql`; REST ingestion under `/api/v1`
- `reactflow` for the decision graph; Tailwind for styling
- Stripe (test mode) for billing
- Vitest (unit) + Playwright (e2e); GitHub Actions for CI
- Deploy target: Vercel + Neon Postgres

## Quickstart

Prerequisites: Node 24, npm, a running PostgreSQL.

```bash
# 1. install
npm ci

# 2. env: copy the example and fill in DATABASE_URL (and, for the console,
#    a GitHub OAuth app in AUTH_GITHUB_ID / AUTH_GITHUB_SECRET)
cp .env.example .env

# 3. schema
npx prisma db push

# 4. demo data (idempotent): a demo org, two agents, a policy set, ~40 decisions
npm run seed

# 5. run
npm run dev
```

`npm run seed` prints the demo agents' raw API keys. Use one as the Bearer token
against the ingestion API.

## Data flow

1. An agent POSTs `{ action, resource, context }` to `/api/v1/decisions` with its
   API key as a Bearer token.
2. The API resolves the agent by the SHA-256 hash of the key (401 if unknown),
   loads that organization's enabled policies, and maps them to engine rules.
3. `decide(rules, { action, resource })` returns `{ granted, decidingPolicy,
   applicable }` using default-deny and conflict resolution (priority, then
   resource specificity, then deny-overrides).
4. A `Decision` row is persisted with the audit JSON (ordered applicable rule
   ids + the request context). On a deny, enabled `decision.denied` webhooks
   fire, HMAC-signed.
5. The console queries decisions, policies, analytics, and the decision graph
   through the org-scoped GraphQL API.

## REST API example

```bash
curl -X POST http://localhost:3000/api/v1/decisions \
  -H "Authorization: Bearer ag_live_1111111111111111111111111111111a" \
  -H "Content-Type: application/json" \
  -d '{ "action": "refund", "resource": "billing.eu", "context": { "amount": 900 } }'
```

Response:

```json
{ "granted": false, "decisionId": "clx...", "decidingPolicy": "clp..." }
```

With the demo seed's policy set, `billing.eu` is denied (the specific EU deny
beats the broad billing allow), while `billing.us` is allowed.

## RBAC and multi-tenancy

Every domain row (agents, policies, decisions, webhooks, subscription) is scoped
to an `Organization`. A user joins an org through a `Membership` carrying a
`Role` (OWNER > ADMIN > MEMBER). Server code that touches org-scoped data goes
through `getActiveOrg()` (the caller's current org, from an `org` cookie set on
switch, or their first membership) and `requireRole(orgId, min)`, so tenancy and
role checks live in one place. MEMBER can read; ADMIN and above can mutate
policies and agents; OWNER manages members and billing. The ingestion API is not
session-based: it authenticates the agent by its API-key hash and scopes all
work to that agent's organization.

## Security

- Agent API keys are stored only as a SHA-256 hash; the raw key is shown once at
  creation and never persisted.
- Webhook delivery is SSRF-guarded: outbound webhook URLs are validated before
  delivery to block private, loopback, and link-local targets, and payloads are
  HMAC-signed with a per-endpoint secret.
- Tenant isolation is enforced through `getActiveOrg` / `requireRole` on every
  org-scoped path; the ingestion API scopes strictly to the resolved agent's org.
- Secrets come only from environment variables; none are committed. The values
  in CI and the e2e config are dummy dev-only placeholders.
- The policy verdict is always computed by the engine, never by the UI.

See `DECISIONS.md` for the design rationale and an honest list of what this
project does and does not prove.
