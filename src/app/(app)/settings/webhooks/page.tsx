import { PageHeader, EmptyState } from "@/components/ui";
import { WebhooksManager } from "@/components/WebhooksManager";
import { gql, type Webhook } from "@/lib/gql";
import { WEBHOOKS_QUERY } from "@/lib/queries";

interface WebhooksData {
  webhooks: Webhook[];
}

export default async function WebhooksPage() {
  let data: WebhooksData | null = null;
  try {
    data = await gql<WebhooksData>(WEBHOOKS_QUERY);
  } catch {
    data = null;
  }

  return (
    <>
      <PageHeader
        title="Webhooks"
        description="Deliver decision events to your systems, signed with a per-endpoint secret."
      />
      {!data ? (
        <EmptyState
          title="Couldn't load webhooks"
          hint="The API is unavailable right now. Once it's up, your endpoints will appear here."
        />
      ) : (
        <WebhooksManager webhooks={data.webhooks} />
      )}
    </>
  );
}
