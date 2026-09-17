/**
 * The GraphQL SDL the console consumes. All fields are org-scoped and
 * authorized in the resolvers (see resolvers.ts). Kept as a plain string so it
 * can be paired with the resolver map by graphql-yoga's `createSchema`.
 */
export const typeDefs = /* GraphQL */ `
  scalar DateTime
  scalar JSON

  enum Role {
    OWNER
    ADMIN
    MEMBER
  }

  enum Effect {
    ALLOW
    DENY
  }

  enum Plan {
    FREE
    PRO
  }

  enum AnalyticsRange {
    DAY
    WEEK
    MONTH
  }

  type User {
    id: ID!
    name: String
    email: String
    image: String
  }

  type Organization {
    id: ID!
    name: String!
    slug: String!
    role: Role
    createdAt: DateTime!
  }

  type Agent {
    id: ID!
    name: String!
    apiKeyPrefix: String!
    createdAt: DateTime!
  }

  type Policy {
    id: ID!
    name: String!
    action: String!
    resource: String!
    subtree: Boolean!
    effect: Effect!
    priority: Int!
    enabled: Boolean!
    createdAt: DateTime!
  }

  type Decision {
    id: ID!
    action: String!
    resource: String!
    granted: Boolean!
    decidingPolicy: String
    createdAt: DateTime!
    agent: Agent
  }

  type DecisionConnection {
    nodes: [Decision!]!
    nextCursor: String
  }

  type DecisionEdge {
    id: ID!
    fromId: ID!
    toId: ID!
    label: String!
  }

  "The decision graph: recent decisions and the succession edges among them."
  type DecisionGraph {
    nodes: [Decision!]!
    edges: [DecisionEdge!]!
  }

  "A single decision with its full audit trail and graph edges."
  type DecisionDetail {
    id: ID!
    action: String!
    resource: String!
    granted: Boolean!
    decidingPolicy: String
    applied: JSON!
    createdAt: DateTime!
    agent: Agent
    edges: [DecisionEdge!]!
  }

  type AgentBreakdown {
    agentId: ID!
    agentName: String!
    total: Int!
    allowed: Int!
    denied: Int!
  }

  type Analytics {
    range: AnalyticsRange!
    total: Int!
    allowed: Int!
    denied: Int!
    allowRate: Float!
    denyRate: Float!
    perAgent: [AgentBreakdown!]!
  }

  type Webhook {
    id: ID!
    url: String!
    event: String!
    enabled: Boolean!
    createdAt: DateTime!
  }

  type Subscription {
    id: ID!
    plan: Plan!
    status: String!
  }

  "Returned once on creation — carries the raw key, shown a single time."
  type CreateAgentResult {
    agent: Agent!
    rawKey: String!
  }

  input DecisionFilter {
    agentId: ID
    granted: Boolean
    action: String
    resource: String
  }

  input UpsertPolicyInput {
    id: ID
    name: String!
    action: String!
    resource: String!
    subtree: Boolean
    effect: Effect!
    priority: Int
    enabled: Boolean
  }

  type Query {
    me: User
    activeOrg: Organization
    agents: [Agent!]!
    policies: [Policy!]!
    decisions(limit: Int, cursor: String, filter: DecisionFilter): DecisionConnection!
    decision(id: ID!): DecisionDetail
    decisionGraph(limit: Int): DecisionGraph!
    analytics(range: AnalyticsRange = WEEK): Analytics!
    webhooks: [Webhook!]!
    subscription: Subscription
  }

  type Mutation {
    createAgent(name: String!): CreateAgentResult!
    revokeAgent(id: ID!): Boolean!
    upsertPolicy(input: UpsertPolicyInput!): Policy!
    deletePolicy(id: ID!): Boolean!
    createWebhook(url: String!, event: String): Webhook!
    deleteWebhook(id: ID!): Boolean!
  }
`;
