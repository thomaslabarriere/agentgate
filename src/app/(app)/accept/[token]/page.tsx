import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, setActiveOrg } from "@/lib/auth";

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
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Join {org.name}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          You&apos;ve been invited to join <span className="font-medium">{org.name}</span>{" "}
          as <span className="font-medium">{invitation.role}</span>.
        </p>
      </div>
      <form action={accept}>
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Accept invitation
        </button>
      </form>
    </main>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-3 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
    </main>
  );
}
