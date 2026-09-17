import { createSchema } from "graphql-yoga";
import {
  execute,
  parse,
  validate,
  specifiedRules,
  NoSchemaIntrospectionCustomRule,
  GraphQLError,
} from "graphql";

import { typeDefs } from "@/lib/graphql/schema";
import { resolvers } from "@/lib/graphql/resolvers";
import { buildContext } from "@/lib/graphql/context";

export const runtime = "nodejs";

// We build the executable schema with graphql-yoga's helper but run it with the
// `graphql` package's parse/validate/execute directly. graphql-yoga's own
// request handler reads the request body as a stream, which is incompatible
// with the Next.js 16 production runtime on Vercel (ERR_INVALID_ARG_TYPE:
// transform.readable). A plain JSON-in/JSON-out handler avoids the stream path.
const schema = createSchema({ typeDefs, resolvers });
const isProd = process.env.NODE_ENV === "production";

interface GraphQLBody {
  query?: string;
  variables?: Record<string, unknown> | null;
  operationName?: string | null;
}

export async function POST(request: Request): Promise<Response> {
  let body: GraphQLBody;
  try {
    body = (await request.json()) as GraphQLBody;
  } catch {
    return Response.json({ errors: [{ message: "Invalid JSON body." }] }, { status: 400 });
  }
  if (!body?.query || typeof body.query !== "string") {
    return Response.json({ errors: [{ message: "Missing GraphQL query." }] }, { status: 400 });
  }

  let document;
  try {
    document = parse(body.query);
  } catch (err) {
    const message = err instanceof GraphQLError ? err.message : "Could not parse query.";
    return Response.json({ errors: [{ message }] }, { status: 400 });
  }

  // Disable introspection in production (information-disclosure surface).
  const rules = isProd ? [...specifiedRules, NoSchemaIntrospectionCustomRule] : specifiedRules;
  const validationErrors = validate(schema, document, rules);
  if (validationErrors.length > 0) {
    return Response.json({ errors: validationErrors });
  }

  const contextValue = await buildContext();
  const result = await execute({
    schema,
    document,
    variableValues: body.variables ?? undefined,
    operationName: body.operationName ?? undefined,
    contextValue,
  });
  return Response.json(result);
}

export function GET(): Response {
  return Response.json({ errors: [{ message: "Use POST for GraphQL." }] }, { status: 405 });
}
