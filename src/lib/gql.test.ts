import { describe, expect, it } from "vitest";
import { buildDecisionsQueryString, type DecisionFilter } from "@/lib/filters";

describe("buildDecisionsQueryString", () => {
  it("returns an empty string for an empty filter", () => {
    expect(buildDecisionsQueryString({})).toBe("");
  });

  it("drops empty and undefined fields", () => {
    const filter: DecisionFilter = { agentId: "", action: undefined, resource: "billing" };
    expect(buildDecisionsQueryString(filter)).toBe("resource=billing");
  });

  it("emits keys in a stable order regardless of input order", () => {
    const a = buildDecisionsQueryString({ granted: false, agentId: "ag1" });
    const b = buildDecisionsQueryString({ agentId: "ag1", granted: false });
    expect(a).toBe("agentId=ag1&granted=false");
    expect(a).toBe(b);
  });

  it("serialises the granted boolean, including false", () => {
    expect(buildDecisionsQueryString({ granted: true })).toBe("granted=true");
    expect(buildDecisionsQueryString({ granted: false })).toBe("granted=false");
  });

  it("url-encodes values", () => {
    expect(buildDecisionsQueryString({ resource: "billing eu" })).toBe(
      "resource=billing+eu",
    );
  });

  it("includes every provided field", () => {
    const qs = buildDecisionsQueryString({
      agentId: "ag1",
      action: "refund",
      resource: "billing.eu",
      granted: true,
    });
    expect(qs).toBe("agentId=ag1&action=refund&resource=billing.eu&granted=true");
  });
});
