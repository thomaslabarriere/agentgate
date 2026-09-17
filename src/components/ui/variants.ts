/**
 * Pure variant/class selection for the Badge primitive. Kept in a plain module
 * (no JSX) so the mapping can be unit-tested directly.
 */
import type { Effect } from "@/lib/policy/engine";

export type BadgeVariant = "allow" | "deny" | "role" | "neutral";

export const BADGE_CLASSES: Record<BadgeVariant, string> = {
  allow:
    "bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
  deny: "bg-rose-500/10 text-rose-300 ring-1 ring-inset ring-rose-500/30",
  role: "bg-indigo-500/10 text-indigo-300 ring-1 ring-inset ring-indigo-500/30",
  neutral: "bg-zinc-500/10 text-zinc-300 ring-1 ring-inset ring-zinc-500/25",
};

/** Map a boolean verdict to its badge variant. */
export function variantForGranted(granted: boolean): BadgeVariant {
  return granted ? "allow" : "deny";
}

/** Map a policy effect to its badge variant. */
export function variantForEffect(effect: Effect): BadgeVariant {
  return effect === "ALLOW" ? "allow" : "deny";
}

/** Resolve a variant to its Tailwind class string. */
export function badgeClasses(variant: BadgeVariant): string {
  return BADGE_CLASSES[variant];
}
