import { createSchema, createYoga } from "graphql-yoga";

import { typeDefs } from "@/lib/graphql/schema";
import { resolvers } from "@/lib/graphql/resolvers";
import { buildContext, type GraphQLContext } from "@/lib/graphql/context";

const schema = createSchema<GraphQLContext>({ typeDefs, resolvers });

const { handleRequest } = createYoga({
  schema,
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
  context: () => buildContext(),
});

// Wrap the Yoga handler so the exported route handlers match Next's expected
// (request: Request) signature; Yoga's own second arg (its init context) is not
// used here, so we drop it.
export async function GET(request: Request): Promise<Response> {
  return await handleRequest(request, {});
}

export async function POST(request: Request): Promise<Response> {
  return await handleRequest(request, {});
}
