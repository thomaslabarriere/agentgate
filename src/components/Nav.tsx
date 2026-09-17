"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: { href: string; label: string }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/decisions", label: "Decisions" },
  { href: "/decisions/graph", label: "Graph" },
  { href: "/policies", label: "Policies" },
  { href: "/agents", label: "Agents" },
  { href: "/settings/webhooks", label: "Webhooks" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/decisions") {
    // keep "Decisions" from lighting up on the /decisions/graph route
    return pathname === "/decisions";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The console's primary navigation. Rendered as a horizontal tab bar so it can
 * sit under the auth slice's app header without restructuring the shell.
 */
export function Nav() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="flex items-center gap-1 overflow-x-auto border-b border-zinc-800 px-4">
      {LINKS.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              active
                ? "border-b-2 border-indigo-500 px-3 py-2.5 text-sm font-medium text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
                : "border-b-2 border-transparent px-3 py-2.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export { isActive };
