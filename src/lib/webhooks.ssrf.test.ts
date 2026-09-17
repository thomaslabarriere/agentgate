import { describe, it, expect } from "vitest";
import { isBlockedAddress } from "./webhooks";

describe("isBlockedAddress (SSRF guard)", () => {
  it("blocks loopback, private, link-local, CGNAT, metadata", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.5",
      "172.16.9.9",
      "172.31.255.1",
      "192.168.1.1",
      "169.254.169.254", // cloud metadata
      "100.64.0.1", // CGNAT
      "0.0.0.0",
      "::1",
      "fe80::1",
      "fc00::1",
      "fd12:3456::1",
      "::ffff:127.0.0.1", // IPv4-mapped loopback
    ]) {
      expect(isBlockedAddress(ip), ip).toBe(true);
    }
  });

  it("allows ordinary public addresses", () => {
    for (const ip of ["1.1.1.1", "8.8.8.8", "93.184.216.34", "203.0.113.7", "2606:4700:4700::1111"]) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });

  it("does not block 172.x outside the private 16-31 range", () => {
    expect(isBlockedAddress("172.15.0.1")).toBe(false);
    expect(isBlockedAddress("172.32.0.1")).toBe(false);
  });
});
