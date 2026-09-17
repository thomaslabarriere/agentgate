import { describe, it, expect } from "vitest";
import { GraphQLError } from "graphql";

import { mapPoliciesToRules, assertRole, type PolicyRow } from "@/lib/graphql/resolvers";
import { decide } from "@/lib/policy/engine";

describe("mapPoliciesToRules", () => {
  const rows: PolicyRow[] = [
    {
      id: "p1",
      action: "refund",
      resource: "billing",
      subtree: true,
      effect: "ALLOW",
      priority: 1,
      enabled: true,
    },
    {
      id: "p2",
      action: "refund",
      resource: "billing.eu",
      subtree: false,
      effect: "DENY",
      priority: 1,
      enabled: true,
    },
  ];

  it("maps every engine-relevant column through unchanged", () => {
    const rules = mapPoliciesToRules(rows);
    expect(rules).toEqual([
      { id: "p1", action: "refund", resource: "billing", subtree: true, effect: "ALLOW", priority: 1, enabled: true },
      { id: "p2", action: "refund", resource: "billing.eu", subtree: false, effect: "DENY", priority: 1, enabled: true },
    ]);
  });

  it("feeds the engine so the more specific DENY wins", () => {
    const decision = decide(mapPoliciesToRules(rows), { action: "refund", resource: "billing.eu" });
    expect(decision.granted).toBe(false);
    expect(decision.decidingPolicy).toBe("p2");
  });

  it("preserves order and yields the same length", () => {
    expect(mapPoliciesToRules(rows).map((r) => r.id)).toEqual(["p1", "p2"]);
  });
});

describe("assertRole", () => {
  it("throws when there is no membership role", () => {
    expect(() => assertRole(null, "MEMBER")).toThrow(GraphQLError);
  });

  it("allows an exact-role match", () => {
    expect(assertRole("MEMBER", "MEMBER")).toBe("MEMBER");
    expect(assertRole("ADMIN", "ADMIN")).toBe("ADMIN");
    expect(assertRole("OWNER", "OWNER")).toBe("OWNER");
  });

  it("allows a higher role than required", () => {
    expect(assertRole("OWNER", "MEMBER")).toBe("OWNER");
    expect(assertRole("ADMIN", "MEMBER")).toBe("ADMIN");
    expect(assertRole("OWNER", "ADMIN")).toBe("OWNER");
  });

  it("throws when the role is below the requirement", () => {
    expect(() => assertRole("MEMBER", "ADMIN")).toThrow(GraphQLError);
    expect(() => assertRole("ADMIN", "OWNER")).toThrow(GraphQLError);
    expect(() => assertRole("MEMBER", "OWNER")).toThrow(GraphQLError);
  });
});
