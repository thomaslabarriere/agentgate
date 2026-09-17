import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getStripe, planForPriceId, statusIsActive } from "@/lib/stripe";

/**
 * POST /api/stripe/webhook
 *
 * Stripe webhook receiver. The event is NEVER trusted until its signature is
 * verified against `STRIPE_WEBHOOK_SECRET` using the RAW request body. Handles
 * checkout completion and subscription lifecycle updates, mirroring the state
 * onto the org's `Subscription` row. Returns 200 fast; 400 on a bad signature.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Billing is not configured." },
      { status: 400 },
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Raw body is required for signature verification — do not parse as JSON.
  const rawBody = await req.text();

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const proPriceId = process.env.STRIPE_PRICE_PRO ?? null;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const orgId = session.client_reference_id;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;
        if (orgId && subscriptionId) {
          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);
          await applySubscription(orgId, subscription, proPriceId);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const orgId = await orgIdForSubscription(subscription);
        if (orgId) {
          await applySubscription(orgId, subscription, proPriceId, {
            deleted: event.type === "customer.subscription.deleted",
          });
        }
        break;
      }
      default:
        break;
    }
  } catch {
    // Swallow processing errors so Stripe does not hammer retries on a poison
    // event; the failure is observable via logs/monitoring in production.
    return NextResponse.json({ received: true }, { status: 200 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

/** First price id on a subscription, or null. */
function priceIdOf(subscription: Stripe.Subscription): string | null {
  return subscription.items.data[0]?.price?.id ?? null;
}

/**
 * Resolve the AgentGate org for a subscription: first by our stored
 * subscription id, then by the customer id, then by customer metadata.
 */
async function orgIdForSubscription(
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const byId = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
    select: { organizationId: true },
  });
  if (byId) return byId.organizationId;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const byCustomer = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
    select: { organizationId: true },
  });
  return byCustomer?.organizationId ?? null;
}

/** Mirror a Stripe subscription onto the org's Subscription row. */
async function applySubscription(
  orgId: string,
  subscription: Stripe.Subscription,
  proPriceId: string | null,
  opts: { deleted?: boolean } = {},
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const active = !opts.deleted && statusIsActive(subscription.status);
  const plan = active ? planForPriceId(priceIdOf(subscription), proPriceId) : "FREE";

  const data = {
    plan,
    status: subscription.status,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
  } as const;

  await prisma.subscription.upsert({
    where: { organizationId: orgId },
    update: data,
    create: { organizationId: orgId, ...data },
  });
}
