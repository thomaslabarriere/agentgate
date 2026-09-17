/**
 * Every GraphQL operation string the console sends. Centralised here so the
 * API slice can reconcile these against its SDL in one place. Field selections
 * match `src/lib/graphql/schema.ts`.
 */

export const ME_ORG_QUERY = /* GraphQL */ `
  query MeOrg {
    me { id name email image }
    activeOrg { id name slug role createdAt }
  }
`;

export const DASHBOARD_QUERY = /* GraphQL */ `
  query Dashboard {
    activeOrg { id name slug role createdAt }
    subscription { plan status }
    analytics(range: MONTH) {
      total
      allowed
      denied
      allowRate
      perAgent { agentId agentName total allowed denied }
    }
    decisions(limit: 60) {
      nodes {
        id action resource granted decidingPolicy createdAt
        agent { id name }
      }
      nextCursor
    }
  }
`;

export const DECISIONS_QUERY = /* GraphQL */ `
  query Decisions($limit: Int!, $cursor: String, $filter: DecisionFilter) {
    decisions(limit: $limit, cursor: $cursor, filter: $filter) {
      nodes {
        id action resource granted decidingPolicy createdAt
        agent { id name }
      }
      nextCursor
    }
    agents { id name apiKeyPrefix createdAt }
  }
`;

export const DECISION_DETAIL_QUERY = /* GraphQL */ `
  query DecisionDetail($id: ID!) {
    decision(id: $id) {
      id action resource granted decidingPolicy createdAt
      agent { id name }
      applied
      edges { id fromId toId label }
    }
  }
`;

export const DECISION_GRAPH_QUERY = /* GraphQL */ `
  query DecisionGraph($limit: Int!) {
    decisions(limit: $limit) {
      nodes {
        id action resource granted decidingPolicy createdAt
        agent { id name }
      }
      nextCursor
    }
  }
`;

export const POLICIES_QUERY = /* GraphQL */ `
  query Policies {
    policies {
      id name action resource subtree effect priority enabled createdAt
    }
  }
`;

export const AGENTS_QUERY = /* GraphQL */ `
  query Agents {
    agents { id name apiKeyPrefix createdAt }
  }
`;

export const WEBHOOKS_QUERY = /* GraphQL */ `
  query Webhooks {
    webhooks { id url event enabled createdAt }
  }
`;

// --- Mutations -------------------------------------------------------------

export const CREATE_AGENT_MUTATION = /* GraphQL */ `
  mutation CreateAgent($name: String!) {
    createAgent(name: $name) {
      rawKey
      agent { id name apiKeyPrefix createdAt }
    }
  }
`;

export const REVOKE_AGENT_MUTATION = /* GraphQL */ `
  mutation RevokeAgent($id: ID!) {
    revokeAgent(id: $id)
  }
`;

export const UPSERT_POLICY_MUTATION = /* GraphQL */ `
  mutation UpsertPolicy($input: UpsertPolicyInput!) {
    upsertPolicy(input: $input) {
      id name action resource subtree effect priority enabled createdAt
    }
  }
`;

export const DELETE_POLICY_MUTATION = /* GraphQL */ `
  mutation DeletePolicy($id: ID!) {
    deletePolicy(id: $id)
  }
`;

export const CREATE_WEBHOOK_MUTATION = /* GraphQL */ `
  mutation CreateWebhook($url: String!, $event: String) {
    createWebhook(url: $url, event: $event) {
      id url event enabled createdAt
    }
  }
`;

export const DELETE_WEBHOOK_MUTATION = /* GraphQL */ `
  mutation DeleteWebhook($id: ID!) {
    deleteWebhook(id: $id)
  }
`;
