import { describe, it, expect } from "vitest";
import { decide, applies, resourceMatches, type Rule } from "./engine";

const base: Omit<Rule, "id" | "effect"> = {
  action: "refund",
  resource: "billing",
  subtree: true,
  priority: 0,
  enabled: true,
};

const rule = (id: string, effect: "ALLOW" | "DENY", over: Partial<Rule> = {}): Rule => ({
  ...base,
  id,
  effect,
  ...over,
});

describe("resourceMatches", () => {
  it("exact match", () => {
    expect(resourceMatches(rule("r", "ALLOW", { subtree: false, resource: "billing.refund" }), "billing.refund")).toBe(true);
  });
  it("subtree prefix", () => {
    expect(resourceMatches(rule("r", "ALLOW", { resource: "billing" }), "billing.eu.refund")).toBe(true);
  });
  it("non-prefix is not a match", () => {
    expect(resourceMatches(rule("r", "ALLOW", { resource: "billingX", subtree: true }), "billing.refund")).toBe(false);
  });
  it("wildcard matches anything", () => {
    expect(resourceMatches(rule("r", "ALLOW", { resource: "*" }), "anything.here")).toBe(true);
  });
});

describe("decide", () => {
  it("default-deny when no rule matches", () => {
    const d = decide([], { action: "refund", resource: "billing" });
    expect(d.granted).toBe(false);
    expect(d.decidingPolicy).toBeNull();
    expect(d.applicable).toEqual([]);
  });

  it("a matching allow grants", () => {
    const d = decide([rule("a", "ALLOW")], { action: "refund", resource: "billing.eu" });
    expect(d.granted).toBe(true);
    expect(d.decidingPolicy).toBe("a");
  });

  it("deny overrides allow at an equal key", () => {
    const rules = [rule("a", "ALLOW"), rule("d", "DENY")];
    const req = { action: "refund", resource: "billing" };
    expect(decide(rules, req).granted).toBe(false);
    expect(decide([...rules].reverse(), req).granted).toBe(false); // order-independent
  });

  it("higher priority allow beats lower priority deny", () => {
    const rules = [rule("a", "ALLOW", { priority: 5 }), rule("d", "DENY", { priority: 1 })];
    expect(decide(rules, { action: "refund", resource: "billing" }).granted).toBe(true);
  });

  it("a more specific exact deny beats a broad subtree allow", () => {
    const allow = rule("a", "ALLOW", { resource: "billing", subtree: true });
    const deny = rule("d", "DENY", { resource: "billing.eu.refund", subtree: false });
    expect(decide([allow, deny], { action: "refund", resource: "billing.eu.refund" }).granted).toBe(false);
  });

  it("wildcard action matches a specific request", () => {
    const d = decide([rule("a", "ALLOW", { action: "*" })], { action: "refund", resource: "billing" });
    expect(d.granted).toBe(true);
  });

  it("a disabled rule never applies", () => {
    expect(applies(rule("a", "ALLOW", { enabled: false }), { action: "refund", resource: "billing" })).toBe(false);
  });

  it("adding a deny never turns a denial into a grant", () => {
    const req = { action: "refund", resource: "billing" };
    const withoutDeny = decide([rule("a", "ALLOW")], req).granted;
    const withDeny = decide([rule("a", "ALLOW"), rule("d", "DENY")], req).granted;
    expect(!(withDeny && !withoutDeny)).toBe(true);
  });

  it("the decision is deterministic regardless of input order", () => {
    const rules = [
      rule("a", "ALLOW", { priority: 2 }),
      rule("b", "DENY", { priority: 2 }),
      rule("c", "ALLOW", { priority: 1 }),
    ];
    const req = { action: "refund", resource: "billing" };
    const d1 = decide(rules, req);
    const d2 = decide([...rules].reverse(), req);
    expect(d1.granted).toBe(d2.granted);
    expect(d1.decidingPolicy).toBe(d2.decidingPolicy);
  });
});
