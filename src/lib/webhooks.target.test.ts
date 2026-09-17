import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DNS so we control exactly what a hostname resolves to, and can assert
// that resolveWebhookTarget *returns the resolved IP* (the pin) rather than
// only validating and leaving the request to re-resolve (the TOCTOU bug).
const lookupMock = vi.fn();
vi.mock("node:dns/promises", () => ({ lookup: (...args: unknown[]) => lookupMock(...args) }));

import { resolveWebhookTarget } from "./webhooks";

describe("resolveWebhookTarget (SSRF pin)", () => {
  beforeEach(() => lookupMock.mockReset());

  it("returns the exact validated public IP to connect to", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    const target = await resolveWebhookTarget("https://example.com/hook");
    expect(target.address).toBe("93.184.216.34");
    expect(target.family).toBe(4);
    expect(target.url.hostname).toBe("example.com");
  });

  it("rejects when the host resolves to a private/metadata address", async () => {
    lookupMock.mockResolvedValue([{ address: "169.254.169.254", family: 4 }]);
    await expect(resolveWebhookTarget("https://rebind.evil/hook")).rejects.toThrow(
      "non-public address",
    );
  });

  it("rejects when ANY resolved address is non-public (multi-record DNS)", async () => {
    lookupMock.mockResolvedValue([
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ]);
    await expect(resolveWebhookTarget("https://mixed.evil/hook")).rejects.toThrow(
      "non-public address",
    );
  });

  it("rejects a non-https url in production", async () => {
    const prev = process.env.NODE_ENV;
    // @ts-expect-error test override
    process.env.NODE_ENV = "production";
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    await expect(resolveWebhookTarget("http://example.com/hook")).rejects.toThrow("https");
    // @ts-expect-error restore
    process.env.NODE_ENV = prev;
  });
});
