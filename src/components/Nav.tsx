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
    <nav className="flex items-center gap-1 overflow-x-auto border-b border-zinc-200 px-4 dark:border-zinc-800">
      {LINKS.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              active
                ? "border-b-2 border-indigo-500 px-3 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100"
                : "border-b-2 border-transparent px-3 py-2.5 text-sm text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
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
