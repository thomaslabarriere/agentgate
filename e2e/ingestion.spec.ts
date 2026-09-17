/**
 * Real end-to-end test of the ingestion path. Playwright's `webServer` builds
 * and starts the app (see playwright.config.ts); here we seed a throwaway org +
 * agent + policies, then drive the public, OAuth-free surfaces:
 *   - POST /api/v1/decisions with a valid key -> engine verdict (allow / deny)
 *   - POST with an unknown key -> 401
 *   - GET / (marketing) -> 200 with the sign-in call to action
 *
 * The console itself is GitHub-OAuth-gated and is out of scope for e2e.
 */
import { test, expect } from "@playwright/test";

import { seedE2E, type E2ESeed } from "./seed";

let seed: E2ESeed;

test.beforeAll(async () => {
  seed = await seedE2E();
});

test.describe("ingestion API", () => {
  test("a DENY case returns { granted: false }", async ({ request }) => {
    const res = await request.post("/api/v1/decisions", {
      headers: { Authorization: `Bearer ${seed.agentKey}` },
      data: { action: seed.denyCase.action, resource: seed.denyCase.resource, context: { amount: 900 } },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { granted: boolean; decisionId: string; decidingPolicy: string | null };
    expect(body.granted).toBe(false);
    expect(typeof body.decisionId).toBe("string");
    expect(body.decisionId.length).toBeGreaterThan(0);
  });

  test("an ALLOW case returns { granted: true }", async ({ request }) => {
    const res = await request.post("/api/v1/decisions", {
      headers: { Authorization: `Bearer ${seed.agentKey}` },
      data: { action: seed.allowCase.action, resource: seed.allowCase.resource, context: { amount: 120 } },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { granted: boolean; decisionId: string; decidingPolicy: string | null };
    expect(body.granted).toBe(true);
    expect(body.decidingPolicy).not.toBeNull();
  });

  test("an unknown API key returns 401", async ({ request }) => {
    const res = await request.post("/api/v1/decisions", {
      headers: { Authorization: "Bearer ag_live_not_a_real_key_000000000000000000" },
      data: { action: "refund", resource: "billing.us" },
    });
    expect(res.status()).toBe(401);
  });
});

test("the marketing page renders with the sign-in CTA", async ({ request }) => {
  const res = await request.get("/");
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain("Sign in with GitHub");
});
