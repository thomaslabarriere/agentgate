import { describe, it, expect } from "vitest";

import { signPayload, buildDeniedPayload, DENIED_EVENT } from "@/lib/webhooks";

describe("signPayload", () => {
  it("is deterministic", () => {
    expect(signPayload("s", "body")).toBe(signPayload("s", "body"));
  });

  it("matches a known HMAC-SHA256 vector", () => {
    expect(signPayload("whsec_test", '{"a":1}')).toBe(
      "51426af50a41dd7ff2cd3f116594734766d4018d15d6fb07169aee5d2959adf5",
    );
  });

  it("produces a 64-char hex digest", () => {
    expect(signPayload("s", "body")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs when the secret differs", () => {
    expect(signPayload("s1", "body")).not.toBe(signPayload("s2", "body"));
  });

  it("differs when the body differs", () => {
    expect(signPayload("s", "a")).not.toBe(signPayload("s", "b"));
  });
});

describe("buildDeniedPayload", () => {
  it("carries the decision verdict and audit fields", () => {
    const payload = buildDeniedPayload({
      decisionId: "d1",
      organizationId: "o1",
      action: "refund",
      resource: "billing.eu",
      decision: { granted: false, decidingPolicy: "p1", applicable: ["p1", "p2"] },
    });
    expect(payload).toEqual({
      event: DENIED_EVENT,
      decisionId: "d1",
      organizationId: "o1",
      action: "refund",
      resource: "billing.eu",
      granted: false,
      decidingPolicy: "p1",
      applicable: ["p1", "p2"],
    });
  });
});
