"use client";

import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { decisionsToFlow, type FlowNode } from "@/lib/graph";
import type { Decision, DecisionEdge } from "@/lib/gql";

const ALLOW_STYLE = {
  background: "rgba(16,185,129,0.12)",
  border: "1px solid rgba(16,185,129,0.5)",
  color: "#a7f3d0",
  borderRadius: 10,
  fontSize: 12,
  padding: "8px 12px",
  width: 190,
} as const;

const DENY_STYLE = {
  background: "rgba(244,63,94,0.12)",
  border: "1px solid rgba(244,63,94,0.5)",
  color: "#fecdd3",
  borderRadius: 10,
  fontSize: 12,
  padding: "8px 12px",
  width: 190,
} as const;

function toRfNode(n: FlowNode): Node {
  return {
    id: n.id,
    position: n.position,
    data: { label: n.data.label },
    style: n.data.granted ? { ...ALLOW_STYLE } : { ...DENY_STYLE },
  };
}

export function DecisionGraph({
  decisions,
  edges,
}: {
  decisions: Decision[];
  edges: DecisionEdge[];
}) {
  const { nodes, rfEdges } = useMemo(() => {
    const flow = decisionsToFlow(decisions, edges);
    const rfNodes: Node[] = flow.nodes.map(toRfNode);
    const mapped: Edge[] = flow.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: e.animated,
      labelStyle: { fill: "#a1a1aa", fontSize: 11 },
      style: { stroke: "#52525b" },
    }));
    return { nodes: rfNodes, rfEdges: mapped };
  }, [decisions, edges]);

  return (
    <div className="h-[600px] w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
      <ReactFlow
        nodes={nodes}
        edges={rfEdges}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
      >
        <Background color="#3f3f46" gap={20} />
        <Controls className="!bg-zinc-800 !text-zinc-100" />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) =>
            (n.style?.border as string)?.includes("16,185,129")
              ? "#10b981"
              : "#f43f5e"
          }
          maskColor="rgba(9,9,11,0.6)"
          className="!bg-zinc-900"
        />
      </ReactFlow>
    </div>
  );
}
