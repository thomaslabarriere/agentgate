# Design decisions and limits

This records the load-bearing design choices in AgentGate and, honestly, what
the project does not prove. No em-dashes below on purpose.

## Policy model: default-deny

The engine denies unless a rule explicitly allows. A request with no matching
rule is denied with `decidingPolicy: null`. This is the safe default for an
authorization system: adding an agent or a new resource cannot silently grant
access. It also makes the audit trail meaningful, because every allow points at
the specific rule that produced it.

## Conflict resolution: priority > specificity > deny-overrides

When several rules match a request, the engine ranks them by a tuple compared
lexicographically, highest wins:

1. `priority` (explicit operator intent wins first),
2. resource specificity (an exact resource beats a subtree prefix; a deeper
   subtree prefix beats a shallower one; `*` is least specific),
3. deny-overrides (DENY beats ALLOW at an otherwise-equal rank),
4. rule id (a final deterministic tie-break).

So a broad `billing` allow and a specific `billing.eu` deny resolve to deny for
`billing.eu` on specificity, while a high-priority `classified` deny beats an
`admin-all` allow on priority. The rule is deterministic and testable in
isolation, which is why the engine is pure.

## The verdict comes from the engine, never the UI

`decide()` is the single source of truth. The ingestion API calls it; the seed
calls it to produce demo decisions; the console only displays a persisted
verdict, it never recomputes one. This keeps what a user sees identical to what
the system enforced, and it means the engine's unit tests cover the real
decision logic rather than a copy.

## Multi-tenant isolation

Every domain row is scoped to an `Organization`. Console access goes through
`getActiveOrg()` and `requireRole()` so tenancy and RBAC checks live in one
place instead of being re-derived per resolver. The ingestion API is not
session-based: it resolves the agent by the SHA-256 hash of its API key and
scopes all work to that agent's organization, so a leaked or wrong key cannot
reach another tenant's policies or decisions.

## SSRF-guarded webhooks

`decision.denied` webhooks deliver to operator-supplied URLs, which is a classic
SSRF sink. Outbound URLs are validated before delivery to reject private,
loopback, and link-local targets, and each delivery is HMAC-signed with the
endpoint's secret so a receiver can verify authenticity. Delivery is best-effort
and never fails the ingestion path.

## Seed and e2e are deterministic and offline

The seed uses deterministic org slug, agent keys, and sample requests, and
converges on re-run (upsert by unique key, replace the policy set and
decisions). The e2e test seeds a throwaway org with a known key and asserts real
API behavior. Both run against a local Postgres with no network dependency.

## What this does NOT prove

- Demo scale only. The seed is ~40 decisions across 2 agents. There is no load,
  latency, or large-tenant testing, and no pagination stress on the audit log.
- Stripe billing is test-mode and requires real test keys in the environment to
  exercise; without them the billing flow is not run here.
- The OAuth console is not covered by e2e. Sign-in requires a real GitHub OAuth
  app, so the e2e suite deliberately tests the OAuth-free surfaces: the REST
  ingestion API (allow, deny, 401) and the public marketing page. The logged-in
  console (dashboard, policy editor, graph, analytics) is not exercised
  end-to-end here.
- Single region, single Postgres. No replication, failover, or multi-region
  behavior is demonstrated.
- Webhook SSRF protection blocks the common private-range targets; it is not a
  substitute for a full egress proxy or DNS-rebinding defense in a hostile
  production network.
- CI proves the build, unit tests, lint, and the ingestion e2e pass against a
  fresh Postgres. It does not deploy or run against production data.
