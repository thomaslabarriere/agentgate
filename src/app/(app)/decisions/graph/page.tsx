import { PageHeader, EmptyState, Card, CardBody } from "@/components/ui";
import { DecisionGraph } from "@/components/DecisionGraph";
import { gql, type Decision, type DecisionDetail, type DecisionEdge } from "@/lib/gql";
import { DECISION_GRAPH_QUERY, DECISION_DETAIL_QUERY } from "@/lib/queries";

interface GraphListData {
  decisions: { nodes: Decision[] };
}

// The SDL exposes edges only on `decision(id)`, so we fetch a bounded set of
// decisions and then resolve their edges concurrently.
const MAX_NODES = 40;

export default async function DecisionGraphPage() {
  let nodes: Decision[] = [];
  let edges: DecisionEdge[] = [];

  try {
    const list = await gql<GraphListData>(DECISION_GRAPH_QUERY, { limit: MAX_NODES });
    nodes = list.decisions.nodes;

    const details = await Promise.all(
      nodes.map((d) =>
        gql<{ decision: DecisionDetail | null }>(DECISION_DETAIL_QUERY, { id: d.id })
          .then((r) => r.decision?.edges ?? [])
          .catch(() => [] as DecisionEdge[]),
      ),
    );
    const all = details.flat();
    edges = Array.from(new Map(all.map((e) => [e.id, e])).values());
  } catch {
    nodes = [];
    edges = [];
  }

  return (
    <>
      <PageHeader
        title="Decision graph"
        description="How decisions relate — each node is a decision, coloured by verdict; edges show what led to what."
      />
      {nodes.length === 0 ? (
        <EmptyState
          title="No graph to draw yet"
          hint="Once decisions and their edges exist, they'll be plotted here as an interactive graph."
          icon="⬡"
        />
      ) : (
        <>
          <DecisionGraph decisions={nodes} edges={edges} />
          <Card className="mt-4">
            <CardBody className="flex flex-wrap items-center gap-6 text-xs text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/70 ring-1 ring-emerald-400" />
                Allowed decision
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-rose-500/70 ring-1 ring-rose-400" />
                Denied decision
              </span>
              <span className="text-zinc-500">
                {nodes.length} decisions · {edges.length} edges
              </span>
            </CardBody>
          </Card>
        </>
      )}
    </>
  );
}
