"use server";

import { gql, type DecisionDetail, type DecisionFilter, type DecisionPage } from "@/lib/gql";
import { DECISIONS_QUERY, DECISION_DETAIL_QUERY } from "@/lib/queries";

interface DecisionsResult {
  decisions: DecisionPage;
}

/** Fetch a page of decisions (used by "Load more" in the browser). */
export async function fetchDecisions(
  filter: DecisionFilter,
  cursor: string | null,
  limit = 25,
): Promise<DecisionPage> {
  const data = await gql<DecisionsResult>(DECISIONS_QUERY, {
    limit,
    cursor,
    filter,
  });
  return data.decisions;
}

interface DetailResult {
  decision: DecisionDetail | null;
}

/** Fetch the full audit trail + edges for one decision (drawer). */
export async function fetchDecisionDetail(id: string): Promise<DecisionDetail | null> {
  const data = await gql<DetailResult>(DECISION_DETAIL_QUERY, { id });
  return data.decision;
}
