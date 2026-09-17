import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getActiveOrg, getCurrentUser, roleAtLeast } from "@/lib/auth";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

/**
 * POST /api/stripe/checkout
 *
 * Session-authenticated (OWNER of the active org). Creates a Stripe Checkout
 * Session for the PRO subscription and returns `{ url }` for the client to
 * redirect to. A Stripe customer is created once per org and reused thereafter.
 */
export async function POST(): Promise<NextResponse> {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Billing is not configured." },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await getActiveOrg();
  if (!org) {
    return NextResponse.json({ error: "No active organization" }, { status: 400 });
  }

  // OWNER-only. Do not use requireRole() here: it redirects on unauthenticated,
  // which is wrong for a JSON API. Check the membership explicitly.
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
  });
  if (!membership || !roleAtLeast(membership.role, Role.OWNER)) {
    return NextResponse.json(
      { error: "Only an organization owner can manage billing." },
      { status: 401 },
    );
  }

  const priceId = process.env.STRIPE_PRICE_PRO;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!priceId || !appUrl) {
    return NextResponse.json(
      { error: "Billing is not fully configured." },
      { status: 400 },
    );
  }

  const stripe = getStripe();

  // Create-or-reuse a Stripe customer for this org.
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: org.id },
  });

  let customerId = subscription?.stripeCustomerId ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: org.name,
      email: user.email ?? undefined,
      metadata: { organizationId: org.id },
    });
    customerId = customer.id;
    await prisma.subscription.upsert({
      where: { organizationId: org.id },
      update: { stripeCustomerId: customerId },
      create: { organizationId: org.id, stripeCustomerId: customerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: org.id,
    success_url: `${appUrl}/settings/billing?checkout=success`,
    cancel_url: `${appUrl}/settings/billing?checkout=cancel`,
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe did not return a checkout URL." },
      { status: 400 },
    );
  }

  return NextResponse.json({ url: session.url });
}
