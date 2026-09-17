import { describe, it, expect } from "vitest";

import { generateApiKey, hashApiKey } from "@/lib/apikey";

describe("hashApiKey", () => {
  it("is deterministic", () => {
    expect(hashApiKey("ag_live_abc")).toBe(hashApiKey("ag_live_abc"));
  });

  it("produces a 64-char sha256 hex digest", () => {
    expect(hashApiKey("ag_live_abc")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs for different inputs", () => {
    expect(hashApiKey("a")).not.toBe(hashApiKey("b"));
  });
});

describe("generateApiKey", () => {
  it("emits a raw key of the form ag_live_<32 hex>", () => {
    const { raw } = generateApiKey();
    expect(raw).toMatch(/^ag_live_[0-9a-f]{32}$/);
  });

  it("hash is sha256(raw) and never equals the raw key", () => {
    const { raw, hash } = generateApiKey();
    expect(hash).toBe(hashApiKey(raw));
    expect(hash).not.toBe(raw);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("prefix is the leading slice of the raw key (display-safe)", () => {
    const { raw, prefix } = generateApiKey();
    expect(prefix.length).toBe(12);
    expect(raw.startsWith(prefix)).toBe(true);
    expect(prefix.startsWith("ag_live_")).toBe(true);
  });

  it("is unique across calls", () => {
    expect(generateApiKey().raw).not.toBe(generateApiKey().raw);
  });
});
