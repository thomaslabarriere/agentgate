import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Route protection for the authenticated `(app)` area.
 *
 * We intentionally do a lightweight, edge-safe check here — the presence of an
 * Auth.js session cookie — rather than a full DB session lookup (the Prisma
 * adapter is not available on the edge). The real authorization (membership +
 * role, tenant scoping) is enforced in the pages/actions via `requireRole` and
 * `getActiveOrg`. This middleware only bounces obviously-unauthenticated
 * visitors to the sign-in (marketing) page.
 *
 * The matcher deliberately excludes `/api/*` (both `/api/v1` agent API-key auth
 * and `/api/auth` Auth.js routes must stay reachable) and static assets.
 */

// Auth.js v5 session cookie names (dev is unsecured, prod is `__Secure-`).
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export function middleware(request: NextRequest): NextResponse {
  const hasSession = SESSION_COOKIES.some(
    (name) => request.cookies.get(name)?.value,
  );

  if (!hasSession) {
    const signInUrl = new URL("/", request.url);
    signInUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Protect the authenticated app surface only. Route groups like `(app)` do
  // not appear in the URL, so we list the concrete top-level segments the app
  // slice serves. `/api/*`, `/_next/*`, the marketing landing (`/`) and static
  // files are all left untouched.
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/settings/:path*",
    "/accept/:path*",
    "/decisions/:path*",
    "/policies/:path*",
    "/agents/:path*",
    "/analytics/:path*",
    "/webhooks/:path*",
    "/billing/:path*",
  ],
};
