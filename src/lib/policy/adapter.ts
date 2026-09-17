/**
 * The Policy -> Rule adapter: turns persisted Policy rows into the engine's
 * dependency-free `Rule[]`. It lives beside the engine (its home) so the
 * ingestion path can map policies to rules without importing the GraphQL
 * resolver module. Pure; no verdict logic here.
 */
import type { Effect as PrismaEffect } from "@prisma/client";

import type { Rule } from "@/lib/policy/engine";

/** A Policy row as far as rule-mapping cares — the engine-relevant columns. */
export interface PolicyRow {
  id: string;
  action: string;
  resource: string;
  subtree: boolean;
  effect: PrismaEffect;
  priority: number;
  enabled: boolean;
}

/** Map persisted Policy rows to engine `Rule[]`. Pure; no verdict logic here. */
export function mapPoliciesToRules(policies: PolicyRow[]): Rule[] {
  return policies.map((p) => ({
    id: p.id,
    action: p.action,
    resource: p.resource,
    subtree: p.subtree,
    effect: p.effect, // Prisma Effect ("ALLOW"|"DENY") === engine Effect
    priority: p.priority,
    enabled: p.enabled,
  }));
}
