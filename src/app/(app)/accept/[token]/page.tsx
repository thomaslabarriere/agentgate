import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, setActiveOrg } from "@/lib/auth";
import { Badge, Button, Card, CardBody, CardHeader } from "@/components/ui";

export const metadata = { title: "Accept invitation — AgentGate" };

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/");

  const invitation = await prisma.invitation.findUnique({ where: { token } });

  if (!invitation) {
    return (
      <Message
        title="Invitation not found"
        body="This invite link is invalid or has already been used."
      />
    );
  }

  // The invite is bound to an email address; the signed-in user must match it.
  const userEmail = user.email?.toLowerCase() ?? null;
  const emailMatches = userEmail !== null && userEmail === invitation.email.toLowerCase();
  if (!emailMatches) {
    return (
      <Message
        title="This invitation is for a different account"
        body={`It was sent to ${invitation.email}. Sign in with that account to accept it.`}
      />
    );
  }

  const org = await prisma.organization.findUnique({
    where: { id: invitation.organizationId },
  });
  if (!org) {
    return (
      <Message
        title="Organization no longer exists"
        body="The organization that sent this invite is gone."
      />
    );
  }

  async function accept() {
    "use server";
    const current = await getCurrentUser();
    if (!current) redirect("/");

    // Re-load inside the action; the invite may have been revoked meanwhile.
    const invite = await prisma.invitation.findUnique({ where: { token } });
    if (!invite) redirect(`/accept/${token}`);

    const email = current.email?.toLowerCase() ?? null;
    if (email === null || email !== invite.email.toLowerCase()) {
      redirect(`/accept/${token}`);
    }

    // Create the membership (idempotent) and consume the invite atomically.
    await prisma.$transaction([
      prisma.membership.upsert({
        where: {
          userId_organizationId: {
            userId: current.id,
            organizationId: invite.organizationId,
          },
        },
        update: { role: invite.role },
        create: {
          userId: current.id,
          organizationId: invite.organizationId,
          role: invite.role,
        },
      }),
      prisma.invitation.delete({ where: { id: invite.id } }),
    ]);

    await setActiveOrg(invite.organizationId);
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-md py-16">
      <Card>
        <CardHeader
          title={`Join ${org.name}`}
          subtitle="You've been invited to this organization."
        />
        <CardBody className="flex flex-col gap-4">
          <p className="flex items-center gap-2 text-sm text-zinc-300">
            Role
            <Badge variant="role">{invitation.role}</Badge>
          </p>
          <form action={accept}>
            <Button type="submit">Accept invitation</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-md py-16">
      <Card>
        <CardHeader title={title} />
        <CardBody>
          <p className="text-sm text-zinc-400">{body}</p>
        </CardBody>
      </Card>
    </div>
  );
}
