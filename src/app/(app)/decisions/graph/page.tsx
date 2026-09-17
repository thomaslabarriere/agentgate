import { PageHeader, EmptyState, Card, CardBody } from "@/components/ui";
import { DecisionGraph } from "@/components/DecisionGraph";
import { gql, type Decision, type DecisionEdge, type DecisionGraphData } from "@/lib/gql";
import { DECISION_GRAPH_QUERY } from "@/lib/queries";

interface GraphData {
  decisionGraph: DecisionGraphData;
}

// The graph is fetched in a SINGLE `decisionGraph` query (nodes + edges) rather
// than N+1 per-decision calls.
const MAX_NODES = 40;

export default async function DecisionGraphPage() {
  let nodes: Decision[] = [];
  let edges: DecisionEdge[] = [];

  try {
    const data = await gql<GraphData>(DECISION_GRAPH_QUERY, { limit: MAX_NODES });
    nodes = data.decisionGraph.nodes;
    edges = data.decisionGraph.edges;
  } catch {
    nodes = [];
    edges = [];
  }

  return (
    <>
      <PageHeader
        title="Decision graph"
        description="How decisions relate — each node is a decision, coloured by verdict; an edge links an agent's consecutive decisions in time order (it succeeds the one before it)."
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
              <span className="inline-flex items-center gap-1.5">
                <span className="h-px w-5 bg-zinc-500" />
                Edge = same agent, next decision (&ldquo;succeeds&rdquo;)
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
