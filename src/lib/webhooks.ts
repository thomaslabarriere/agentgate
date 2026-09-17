import { createHmac } from "node:crypto";
import { lookup } from "node:dns/promises";

import { prisma } from "@/lib/db";
import type { Decision } from "@/lib/policy/engine";

export const DENIED_EVENT = "decision.denied";

/** HMAC-SHA256 hex signature of a raw body string. Pure and deterministic. */
export function signPayload(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

// ---------------------------------------------------------------------------
// SSRF protection: a webhook URL is attacker-influenced (an org admin sets it),
// so a decision could be POSTed to an internal address. Refuse any host that
// resolves to a non-public address before making the request.
// ---------------------------------------------------------------------------

/**
 * Is this resolved IP address off-limits for an outbound webhook? Blocks
 * loopback, link-local (incl. the 169.254.169.254 cloud-metadata address),
 * private, CGNAT, unique-local IPv6, and unspecified addresses. Pure/testable.
 */
export function isBlockedAddress(ip: string): boolean {
  const v4 = ip.includes(".") ? ip.split(".").map(Number) : null;
  if (v4 && v4.length === 4 && v4.every((o) => Number.isInteger(o) && o >= 0 && o <= 255)) {
    const [a, b] = v4;
    if (a === 0 || a === 10 || a === 127) return true; // this-network, private, loopback
    if (a === 169 && b === 254) return true; // link-local (+ metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (v6 === "::1" || v6 === "::" || v6 === "0:0:0:0:0:0:0:1") return true; // loopback/unspecified
  if (v6.startsWith("fe80") || v6.startsWith("fc") || v6.startsWith("fd")) return true; // link-local/ULA
  if (v6.startsWith("::ffff:")) return isBlockedAddress(v6.slice(7)); // IPv4-mapped
  return false;
}

/** Throw if `rawUrl` is not an https (or dev-http) URL to a public host. */
export async function assertSafeWebhookUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("invalid url");
  }
  const httpOk = process.env.NODE_ENV !== "production";
  if (url.protocol !== "https:" && !(httpOk && url.protocol === "http:")) {
    throw new Error("only https webhook urls are allowed");
  }
  const results = await lookup(url.hostname, { all: true });
  if (results.length === 0) throw new Error("host did not resolve");
  for (const { address } of results) {
    if (isBlockedAddress(address)) throw new Error("webhook host resolves to a non-public address");
  }
}

/** The JSON payload shape delivered to a denied-decision webhook. */
export interface DeniedWebhookPayload {
  event: typeof DENIED_EVENT;
  decisionId: string;
  organizationId: string;
  action: string;
  resource: string;
  granted: boolean;
  decidingPolicy: string | null;
  applicable: string[];
}

/**
 * Deliver a denied decision to every enabled `decision.denied` webhook for the
 * org. Best-effort: delivery errors are collected and returned, never thrown
 * into the request path.
 */
export async function deliverDeniedWebhooks(
  orgId: string,
  payload: DeniedWebhookPayload,
): Promise<{ delivered: number; errors: string[] }> {
  const errors: string[] = [];
  let delivered = 0;

  let endpoints: { id: string; url: string; secret: string }[] = [];
  try {
    endpoints = await prisma.webhookEndpoint.findMany({
      where: { organizationId: orgId, enabled: true, event: DENIED_EVENT },
      select: { id: true, url: true, secret: true },
    });
  } catch (err) {
    errors.push(`load: ${errorMessage(err)}`);
    return { delivered, errors };
  }

  const body = JSON.stringify(payload);

  await Promise.all(
    endpoints.map(async (endpoint) => {
      try {
        await assertSafeWebhookUrl(endpoint.url); // SSRF guard before any request
        const res = await fetch(endpoint.url, {
          method: "POST",
          redirect: "error", // a redirect could bounce to an internal host
          headers: {
            "Content-Type": "application/json",
            "X-AgentGate-Signature": signPayload(endpoint.secret, body),
            "X-AgentGate-Event": DENIED_EVENT,
          },
          body,
        });
        if (!res.ok) {
          errors.push(`${endpoint.id}: HTTP ${res.status}`);
          return;
        }
        delivered += 1;
      } catch (err) {
        errors.push(`${endpoint.id}: ${errorMessage(err)}`);
      }
    }),
  );

  return { delivered, errors };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Build the denied-webhook payload from a persisted decision + engine verdict. */
export function buildDeniedPayload(args: {
  decisionId: string;
  organizationId: string;
  action: string;
  resource: string;
  decision: Decision;
}): DeniedWebhookPayload {
  return {
    event: DENIED_EVENT,
    decisionId: args.decisionId,
    organizationId: args.organizationId,
    action: args.action,
    resource: args.resource,
    granted: args.decision.granted,
    decidingPolicy: args.decision.decidingPolicy,
    applicable: args.decision.applicable,
  };
}
