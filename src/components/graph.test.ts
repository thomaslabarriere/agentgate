import { describe, expect, it } from "vitest";
import { decisionsToFlow, nodeClassForGranted } from "@/lib/graph";
import type { Decision, DecisionEdge } from "@/lib/gql";

function decision(id: string, granted: boolean): Decision {
  return {
    id,
    action: "refund",
    resource: "billing.eu",
    granted,
    decidingPolicy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    agent: { id: "ag1", name: "Agent" },
  };
}

function edge(id: string, fromId: string, toId: string, label: string): DecisionEdge {
  return { id, fromId, toId, label };
}

describe("nodeClassForGranted", () => {
  it("colours allow vs deny distinctly", () => {
    expect(nodeClassForGranted(true)).toContain("allow");
    expect(nodeClassForGranted(false)).toContain("deny");
  });
});

describe("decisionsToFlow", () => {
  it("maps decisions to nodes carrying verdict + label", () => {
    const { nodes } = decisionsToFlow([decision("d1", true), decision("d2", false)], []);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].id).toBe("d1");
    expect(nodes[0].data.granted).toBe(true);
    expect(nodes[0].data.label).toBe("refund · billing.eu");
    expect(nodes[1].data.granted).toBe(false);
  });

  it("lays nodes out on a grid (deterministic positions)", () => {
    const { nodes } = decisionsToFlow(
      [decision("a", true), decision("b", true), decision("c", true), decision("d", true), decision("e", true)],
      [],
    );
    expect(nodes[0].position).toEqual({ x: 0, y: 0 });
    // 5th node wraps to the next row (COLS = 4)
    expect(nodes[4].position).toEqual({ x: 0, y: 140 });
  });

  it("maps edges to source/target/label", () => {
    const { edges } = decisionsToFlow(
      [decision("d1", true), decision("d2", false)],
      [edge("e1", "d1", "d2", "led-to")],
    );
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ id: "e1", source: "d1", target: "d2", label: "led-to" });
  });

  it("drops dangling edges whose endpoints are not in the decision set", () => {
    const { edges } = decisionsToFlow(
      [decision("d1", true)],
      [edge("e1", "d1", "missing", "x"), edge("e2", "gone", "d1", "y")],
    );
    expect(edges).toHaveLength(0);
  });
});
