import Link from "next/link";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Mono,
  PageHeader,
  StatTile,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import { Sparkline } from "@/components/Sparkline";
import { gql, type Analytics, type Decision, type Org, type Subscription } from "@/lib/gql";
import { DASHBOARD_QUERY } from "@/lib/queries";
import { formatCount, formatDateTime, formatRate, seriesFromDecisions } from "@/lib/format";
import { variantForGranted } from "@/components/ui/variants";

interface DashboardData {
  activeOrg: Org | null;
  subscription: Subscription | null;
  analytics: Analytics;
  decisions: { nodes: Decision[] };
}

export default async function DashboardPage() {
  let data: DashboardData | null = null;
  try {
    data = await gql<DashboardData>(DASHBOARD_QUERY, { range: "30d" });
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <>
        <PageHeader title="Dashboard" description="Decision activity across your organization." />
        <EmptyState
          title="Nothing to show yet"
          hint="Once your agents start sending actions to the ingestion API, decisions and analytics will appear here."
          icon="◍"
        />
      </>
    );
  }

  const { analytics, decisions, subscription } = data;
  const activeAgents = analytics.perAgent.filter((a) => a.total > 0).length;
  const series = seriesFromDecisions(decisions.nodes);
  const recent = decisions.nodes.slice(0, 8);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Decision activity across your organization, last 30 days."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total decisions" value={formatCount(analytics.total)} />
        <StatTile
          label="Allow rate"
          value={formatRate(analytics.allowRate)}
          accent={analytics.allowRate >= 0.5 ? "allow" : "deny"}
          hint={`${formatCount(analytics.allowed)} allowed · ${formatCount(analytics.denied)} denied`}
        />
        <StatTile label="Active agents" value={formatCount(activeAgents)} />
        <StatTile label="Plan" value={subscription?.plan ?? "FREE"} hint={subscription?.status} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent decisions"
            subtitle="The latest actions your agents requested"
            action={
              <Link href="/decisions" className="text-xs font-medium text-indigo-400 hover:text-indigo-300">
                View all →
              </Link>
            }
          />
          {recent.length === 0 ? (
            <CardBody>
              <EmptyState
                title="No decisions recorded"
                hint="Send an action to POST /api/v1/decisions to see it here."
              />
            </CardBody>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Agent</TH>
                  <TH>Action</TH>
                  <TH>Resource</TH>
                  <TH>Verdict</TH>
                  <TH className="text-right">Time</TH>
                </TR>
              </THead>
              <TBody>
                {recent.map((d) => (
                  <TR key={d.id}>
                    <TD className="text-zinc-200">{d.agent?.name ?? "—"}</TD>
                    <TD>
                      <Mono>{d.action}</Mono>
                    </TD>
                    <TD>
                      <Mono>{d.resource}</Mono>
                    </TD>
                    <TD>
                      <Badge variant={variantForGranted(d.granted)}>
                        {d.granted ? "ALLOW" : "DENY"}
                      </Badge>
                    </TD>
                    <TD className="text-right text-xs text-zinc-500">
                      {formatDateTime(d.createdAt)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Allow / deny" subtitle="Daily volume, last 30 days" />
          <CardBody>
            {series.length === 0 ? (
              <p className="text-sm text-zinc-500">No activity in this range.</p>
            ) : (
              <>
                <Sparkline series={series} />
                <div className="mt-4 flex items-center gap-4 text-xs text-zinc-400">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" /> Allow
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-400" /> Deny
                  </span>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
