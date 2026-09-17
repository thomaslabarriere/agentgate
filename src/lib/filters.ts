/**
 * Decision filter type + query-string builder. Matches the GraphQL
 * `DecisionFilter` input (agentId, action, resource, granted). Pure and free of
 * any server-only import so it can be unit-tested and used on both sides of the
 * boundary.
 */

export interface DecisionFilter {
  agentId?: string;
  action?: string;
  resource?: string;
  granted?: boolean;
}

/**
 * Build a stable URL query string from a decisions filter. Empty / undefined
 * fields are dropped and keys are emitted in a fixed order so the output is
 * deterministic and testable.
 */
export function buildDecisionsQueryString(filter: DecisionFilter): string {
  const params = new URLSearchParams();
  if (filter.agentId) params.set("agentId", filter.agentId);
  if (filter.action) params.set("action", filter.action);
  if (filter.resource) params.set("resource", filter.resource);
  if (typeof filter.granted === "boolean") {
    params.set("granted", String(filter.granted));
  }
  return params.toString();
}
