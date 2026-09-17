/**
 * Stripe integration boundary for AgentGate billing.
 *
 * The client is created lazily so that the rest of the app builds and runs even
 * when Stripe keys are absent (dev, CI, preview). Only code paths that actually
 * talk to Stripe call `getStripe()`, which throws a clear error if the secret
 * key is missing. The pure helpers below carry no Stripe dependency and are
 * unit-tested directly.
 */
import Stripe from "stripe";
import type { Plan } from "@prisma/client";

let client: Stripe | null = null;

/**
 * Lazily construct (and memoize) the Stripe client. Throws a descriptive error
 * when `STRIPE_SECRET_KEY` is unset so misconfiguration surfaces clearly at the
 * call site rather than as an opaque failure deep inside the SDK.
 */
export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Billing is disabled until the Stripe test-mode keys are configured.",
    );
  }
  client = new Stripe(key);
  return client;
}

/** True when the required Stripe env is present (used to gate the UI/routes). */
export function isStripeConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_PRO,
  );
}

// --- Pure, unit-testable helpers -------------------------------------------

/**
 * Map a Stripe price id to the AgentGate plan it represents. The configured PRO
 * price maps to PRO; anything else (including an empty/unknown id) is FREE.
 */
export function planForPriceId(
  priceId: string | null | undefined,
  proPriceId: string | null | undefined,
): Plan {
  if (priceId && proPriceId && priceId === proPriceId) return "PRO";
  return "FREE";
}

/**
 * Whether a Stripe subscription status should be treated as an active
 * entitlement. `active` and `trialing` grant access; everything else (past_due,
 * canceled, unpaid, incomplete, ...) does not.
 */
export function statusIsActive(stripeStatus: string | null | undefined): boolean {
  return stripeStatus === "active" || stripeStatus === "trialing";
}
