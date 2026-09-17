import { PageHeader, EmptyState } from "@/components/ui";
import { DecisionsBrowser } from "@/components/DecisionsBrowser";
import { gql, type Agent, type DecisionPage } from "@/lib/gql";
import { DECISIONS_QUERY } from "@/lib/queries";

interface DecisionsData {
  decisions: DecisionPage;
  agents: Agent[];
}

export default async function DecisionsPage() {
  let data: DecisionsData | null = null;
  try {
    data = await gql<DecisionsData>(DECISIONS_QUERY, { limit: 25, cursor: null, filter: {} });
  } catch {
    data = null;
  }

  return (
    <>
      <PageHeader
        title="Decisions"
        description="Every action your agents requested, and why it was allowed or denied."
      />
      {!data ? (
        <EmptyState
          title="No decisions yet"
          hint="Send an action to POST /api/v1/decisions with an agent API key to record the first decision."
        />
      ) : (
        <DecisionsBrowser
          initialItems={data.decisions.nodes}
          initialCursor={data.decisions.nextCursor}
          agents={data.agents}
        />
      )}
    </>
  );
}
