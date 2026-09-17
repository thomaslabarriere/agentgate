import { PageHeader, EmptyState } from "@/components/ui";
import { AgentsManager } from "@/components/AgentsManager";
import { gql, type Agent } from "@/lib/gql";
import { AGENTS_QUERY } from "@/lib/queries";

interface AgentsData {
  agents: Agent[];
}

export default async function AgentsPage() {
  let data: AgentsData | null = null;
  try {
    data = await gql<AgentsData>(AGENTS_QUERY);
  } catch {
    data = null;
  }

  return (
    <>
      <PageHeader
        title="Agents"
        description="Machine identities that call the ingestion API on behalf of your systems."
      />
      {!data ? (
        <EmptyState
          title="Couldn't load agents"
          hint="The API is unavailable right now. Once it's up, your agents will appear here."
        />
      ) : (
        <AgentsManager agents={data.agents} />
      )}
    </>
  );
}
