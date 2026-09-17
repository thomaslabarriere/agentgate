/**
 * The policy engine: given a set of rules and an (action, resource) request,
 * decide allow or deny. Pure and deterministic, with no database or I/O, so it
 * is unit-testable in isolation and is the single source of truth for a verdict.
 *
 * Policy, mirrored from the Prisma model but dependency-free here:
 *   - default-deny: no matching rule means deny.
 *   - a rule matches when its action matches (exact or "*") and its resource
 *     scope covers the request (exact, or subtree prefix when `subtree`).
 *   - conflicts resolve by a ranking key: priority, then resource specificity
 *     (a longer/exact scope is more specific), then effect (DENY beats ALLOW on
 *     an otherwise-equal key: deny-overrides), then id for determinism.
 *
 * The verdict is computed from the rules and the request, never from anything
 * the agent asserts about itself.
 */

export type Effect = "ALLOW" | "DENY";

export interface Rule {
  id: string;
  action: string; // "refund" or "*"
  resource: string; // dotted scope, e.g. "billing.eu"
  subtree: boolean; // match this scope and everything beneath it
  effect: Effect;
  priority: number;
  enabled: boolean;
}

export interface Request {
  action: string;
  resource: string;
}

export interface Decision {
  granted: boolean;
  decidingPolicy: string | null; // Rule.id, or null on default-deny
  applicable: string[]; // ids of every rule that matched, best-first
}

/** Does a rule's resource scope cover the requested resource? */
export function resourceMatches(rule: Rule, requested: string): boolean {
  if (rule.resource === requested) return true;
  if (rule.resource === "*") return true;
  if (rule.subtree) {
    // "billing" covers "billing.refund", "billing.eu.refund", etc.
    return requested === rule.resource || requested.startsWith(rule.resource + ".");
  }
  return false;
}

export function actionMatches(rule: Rule, requested: string): boolean {
  return rule.action === "*" || rule.action === requested;
}

export function applies(rule: Rule, req: Request): boolean {
  return rule.enabled && actionMatches(rule, req.action) && resourceMatches(rule, req.resource);
}

// Higher scope-specificity wins. Exact resource is most specific; a deeper
// subtree prefix beats a shallower one; "*" is least specific.
function specificity(rule: Rule): number {
  if (rule.resource === "*") return -1;
  if (!rule.subtree) return Number.MAX_SAFE_INTEGER; // exact resource
  return rule.resource.split(".").length; // subtree depth
}

// Ranking tuple compared lexicographically, higher wins:
// [priority, specificity, effectRank, idRank]. DENY outranks ALLOW at a tie
// (deny-overrides); id is a final deterministic tie-break.
function rank(rule: Rule): [number, number, number, string] {
  return [rule.priority, specificity(rule), rule.effect === "DENY" ? 1 : 0, rule.id];
}

function compareRank(a: Rule, b: Rule): number {
  const ra = rank(a);
  const rb = rank(b);
  for (let i = 0; i < 3; i++) {
    if ((ra[i] as number) !== (rb[i] as number)) return (ra[i] as number) - (rb[i] as number);
  }
  // final element is the id: smaller id ranks higher, so invert for "higher wins"
  return ra[3] < rb[3] ? 1 : ra[3] > rb[3] ? -1 : 0;
}

export function decide(rules: Rule[], req: Request): Decision {
  const matching = rules.filter((r) => applies(r, req));
  if (matching.length === 0) {
    return { granted: false, decidingPolicy: null, applicable: [] };
  }
  const ordered = [...matching].sort((a, b) => compareRank(b, a)); // best-first
  const winner = ordered[0];
  return {
    granted: winner.effect === "ALLOW",
    decidingPolicy: winner.id,
    applicable: ordered.map((r) => r.id),
  };
}
