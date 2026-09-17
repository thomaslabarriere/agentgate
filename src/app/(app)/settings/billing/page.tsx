import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getActiveOrg, getCurrentUser, roleAtLeast } from "@/lib/auth";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { isStripeConfigured, statusIsActive } from "@/lib/stripe";
import { UpgradeButton } from "./UpgradeButton";

export const metadata = { title: "Billing — AgentGate" };

const PLAN_COPY = {
  FREE: {
    name: "Free",
    blurb: "Core governance, single project limits, community support.",
  },
  PRO: {
    name: "Pro",
    blurb: "Higher limits, webhooks, priority support, and analytics retention.",
  },
} as const;

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const org = await getActiveOrg();
  if (!org) redirect("/onboarding");

  // OWNER-only: billing management is reserved to organization owners.
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
  });
  if (!membership) redirect("/onboarding");
  if (!roleAtLeast(membership.role, Role.OWNER)) {
    return (
      <>
        <PageHeader
          title="Billing"
          description={`Plan and subscription for ${org.name}.`}
        />
        <EmptyState
          title="Owners only"
          hint="Billing can only be managed by an organization owner. Ask an owner to change the plan."
          icon="🔒"
        />
      </>
    );
  }

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: org.id },
  });
  const plan = subscription?.plan ?? "FREE";
  const status = subscription?.status ?? "active";
  const active = statusIsActive(status);
  const configured = isStripeConfigured();

  return (
    <>
      <PageHeader
        title="Billing"
        description={`Plan and subscription for ${org.name}.`}
      />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader
            title="Current plan"
            subtitle={PLAN_COPY[plan].blurb}
            action={
              <Badge variant={plan === "PRO" ? "role" : "neutral"}>
                {PLAN_COPY[plan].name}
              </Badge>
            }
          />
          <CardBody className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span>Status</span>
              <Badge variant={active ? "allow" : "deny"}>{status}</Badge>
            </div>

            {!configured ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                <p className="font-medium">Billing is not configured</p>
                <p className="mt-1 text-amber-200/80">
                  Stripe test-mode keys are not set in this environment, so
                  upgrades are unavailable. Set the Stripe env vars to enable
                  paid plans.
                </p>
              </div>
            ) : plan === "PRO" ? (
              <p className="text-sm text-emerald-300">
                You&apos;re on Pro — thanks for supporting AgentGate. Manage your
                payment details and invoices from your Stripe receipts.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-zinc-400">
                  Upgrade to Pro to unlock higher limits, webhook delivery, and
                  extended analytics retention.
                </p>
                <UpgradeButton />
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
