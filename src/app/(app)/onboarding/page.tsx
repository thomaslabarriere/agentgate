import { redirect } from "next/navigation";
import { z } from "zod";
import { Plan, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser, setActiveOrg, slugify } from "@/lib/auth";
import { Button, Card, CardBody, CardHeader } from "@/components/ui";

const CreateOrgSchema = z.object({
  name: z.string().trim().min(2, "Organization name is too short").max(60),
});

/** Find a slug not yet taken, appending -2, -3, … when needed. */
async function uniqueSlug(base: string): Promise<string> {
  const seed = base.length > 0 ? base : "org";
  let candidate = seed;
  let n = 1;
   
  while (await prisma.organization.findUnique({ where: { slug: candidate } })) {
    n += 1;
    candidate = `${seed}-${n}`;
  }
  return candidate;
}

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  // Already has an org? Onboarding is done.
  const existing = await prisma.membership.findFirst({ where: { userId: user.id } });
  if (existing) redirect("/dashboard");

  async function createOrg(formData: FormData) {
    "use server";
    const current = await getCurrentUser();
    if (!current) redirect("/");

    const parsed = CreateOrgSchema.safeParse({ name: formData.get("name") });
    if (!parsed.success) {
      redirect("/onboarding?error=name");
    }

    const slug = await uniqueSlug(slugify(parsed.data.name));

    const org = await prisma.organization.create({
      data: {
        name: parsed.data.name,
        slug,
        memberships: {
          create: { userId: current.id, role: Role.OWNER },
        },
        subscription: {
          create: { plan: Plan.FREE },
        },
      },
    });

    await setActiveOrg(org.id);
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-md py-16">
      <Card>
        <CardHeader
          title="Create your organization"
          subtitle="Organizations own agents, policies and their audit trail. You'll be its owner."
        />
        <CardBody>
          <form action={createOrg} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-300">
              Organization name
              <input
                name="name"
                type="text"
                required
                minLength={2}
                maxLength={60}
                placeholder="Acme Inc."
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
              />
            </label>
            <Button type="submit">Create organization</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
