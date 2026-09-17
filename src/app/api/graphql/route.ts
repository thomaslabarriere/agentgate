import { createSchema, createYoga, type Plugin } from "graphql-yoga";
import { NoSchemaIntrospectionCustomRule } from "graphql";

import { typeDefs } from "@/lib/graphql/schema";
import { resolvers } from "@/lib/graphql/resolvers";
import { buildContext, type GraphQLContext } from "@/lib/graphql/context";

const schema = createSchema<GraphQLContext>({ typeDefs, resolvers });

// Introspection is a convenience in development but an information-disclosure
// surface in production, so it is only enabled outside production.
const isProd = process.env.NODE_ENV === "production";
const plugins: Plugin[] = isProd
  ? [
      {
        onValidate({ addValidationRule }) {
          addValidationRule(NoSchemaIntrospectionCustomRule);
        },
      },
    ]
  : [];

const { handleRequest } = createYoga({
  schema,
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
  context: () => buildContext(),
  plugins,
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
