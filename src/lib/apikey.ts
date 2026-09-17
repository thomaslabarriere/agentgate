import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";
import type { Agent } from "@prisma/client";

/** How many display characters of the raw key to store as the prefix. */
const PREFIX_LEN = 12;

/** sha256 hex digest of the raw key. Pure. */
export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export interface GeneratedApiKey {
  /** The full secret, shown to the user exactly once. */
  raw: string;
  /** sha256(raw) — what we persist. */
  hash: string;
  /** First chars of the raw key, safe to display later. */
  prefix: string;
}

/** Mint a new agent API key: `ag_live_<32 hex>`. Pure (no I/O). */
export function generateApiKey(): GeneratedApiKey {
  const raw = `ag_live_${randomBytes(16).toString("hex")}`;
  return {
    raw,
    hash: hashApiKey(raw),
    prefix: raw.slice(0, PREFIX_LEN),
  };
}

export interface VerifiedAgent {
  agent: Agent;
  organizationId: string;
}

/**
 * Resolve an agent from a raw API key by its stored hash. Returns null when
 * no agent matches (caller should answer 401).
 */
export async function verifyAgent(rawKey: string): Promise<VerifiedAgent | null> {
  if (!rawKey) return null;
  const agent = await prisma.agent.findUnique({
    where: { apiKeyHash: hashApiKey(rawKey) },
  });
  if (!agent) return null;
  return { agent, organizationId: agent.organizationId };
}
