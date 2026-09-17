/**
 * Pure mapping from decisions + edges to the node/edge shape reactflow renders.
 * Kept free of any reactflow import so it is trivially unit-testable in a node
 * environment; the page casts the result into reactflow's `Node`/`Edge` types.
 */
import type { Decision, DecisionEdge } from "@/lib/gql";

export interface FlowNodeData {
  label: string;
  granted: boolean;
}

export interface FlowNode {
  id: string;
  position: { x: number; y: number };
  data: FlowNodeData;
  /** semantic verdict class, consumed by the page to colour the node */
  className: string;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  animated: boolean;
}

const COLS = 4;
const X_GAP = 240;
const Y_GAP = 140;

/** allow -> emerald node, deny -> rose node. */
export function nodeClassForGranted(granted: boolean): string {
  return granted ? "rf-node rf-node--allow" : "rf-node rf-node--deny";
}

/**
 * Build the reactflow graph. Nodes are laid out on a simple grid in the given
 * order. Edges are only emitted when BOTH endpoints exist in the decision set
 * (dangling edges are dropped so the canvas never references a missing node).
 */
export function decisionsToFlow(
  decisions: Decision[],
  edges: DecisionEdge[],
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const ids = new Set(decisions.map((d) => d.id));

  const nodes: FlowNode[] = decisions.map((d, i) => ({
    id: d.id,
    position: { x: (i % COLS) * X_GAP, y: Math.floor(i / COLS) * Y_GAP },
    data: {
      label: `${d.action} · ${d.resource}`,
      granted: d.granted,
    },
    className: nodeClassForGranted(d.granted),
  }));

  const flowEdges: FlowEdge[] = edges
    .filter((e) => ids.has(e.fromId) && ids.has(e.toId))
    .map((e) => ({
      id: e.id,
      source: e.fromId,
      target: e.toId,
      label: e.label,
      animated: false,
    }));

  return { nodes, edges: flowEdges };
}
