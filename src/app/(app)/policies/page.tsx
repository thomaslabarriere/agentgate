import { PageHeader, EmptyState } from "@/components/ui";
import { PolicyEditor } from "@/components/PolicyEditor";
import { gql, type Policy } from "@/lib/gql";
import { POLICIES_QUERY } from "@/lib/queries";

interface PoliciesData {
  policies: Policy[];
}

export default async function PoliciesPage() {
  let data: PoliciesData | null = null;
  try {
    data = await gql<PoliciesData>(POLICIES_QUERY);
  } catch {
    data = null;
  }

  return (
    <>
      <PageHeader
        title="Policies"
        description="The rule set the engine evaluates for every agent action. Default-deny."
      />
      {!data ? (
        <EmptyState
          title="Couldn't load policies"
          hint="The API is unavailable right now. Once it's up, your rules will appear here."
        />
      ) : (
        <PolicyEditor policies={data.policies} />
      )}
    </>
  );
}
