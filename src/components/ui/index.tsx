/**
 * Shared UI primitives for the console. A small, consistent design system:
 * dark, calm, generous spacing, one accent (indigo), verdict colours reserved
 * for allow (emerald) / deny (rose). All styling is Tailwind utility classes.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { badgeClasses, type BadgeVariant } from "./variants";

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// --- Card ------------------------------------------------------------------

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-xl border border-zinc-800/80 bg-zinc-900/40 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-800/80 px-5 py-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("p-5", className)}>{children}</div>;
}

// --- Badge -----------------------------------------------------------------

export function Badge({
  children,
  variant = "neutral",
  className,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
        badgeClasses(variant),
        className,
      )}
    >
      {children}
    </span>
  );
}

// --- Button ----------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-indigo-500 text-white hover:bg-indigo-400 focus-visible:outline-indigo-400",
  secondary:
    "border border-zinc-700 bg-zinc-800/60 text-zinc-100 hover:bg-zinc-800 focus-visible:outline-zinc-500",
  ghost:
    "text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100 focus-visible:outline-zinc-500",
  danger:
    "border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 focus-visible:outline-rose-400",
};

export function Button({
  children,
  variant = "primary",
  type = "button",
  className,
  disabled,
  onClick,
  formAction,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  type?: "button" | "submit" | "reset";
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      formAction={formAction}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        BUTTON_VARIANTS[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

// --- StatTile --------------------------------------------------------------

export function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: "allow" | "deny" | "neutral";
}) {
  const valueColor =
    accent === "allow"
      ? "text-emerald-300"
      : accent === "deny"
        ? "text-rose-300"
        : "text-zinc-100";
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className={cx("mt-2 text-3xl font-semibold tabular-nums", valueColor)}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </Card>
  );
}

// --- Table -----------------------------------------------------------------

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-zinc-800/80 text-left text-xs uppercase tracking-wide text-zinc-500">
      {children}
    </thead>
  );
}

export function TH({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th className={cx("px-4 py-2.5 font-medium", className)}>{children}</th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-zinc-800/60">{children}</tbody>;
}

export function TR({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={cx(
        onClick && "cursor-pointer",
        "transition-colors hover:bg-zinc-800/40",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function TD({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <td className={cx("px-4 py-2.5 align-middle text-zinc-300", className)}>
      {children}
    </td>
  );
}

// --- PageHeader ------------------------------------------------------------

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// --- EmptyState ------------------------------------------------------------

export function EmptyState({
  title,
  hint,
  action,
  icon = "◍",
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/20 px-6 py-14 text-center">
      <div className="mb-3 text-2xl text-zinc-600" aria-hidden>
        {icon}
      </div>
      <p className="text-sm font-medium text-zinc-200">{title}</p>
      {hint ? (
        <p className="mt-1 max-w-sm text-sm text-zinc-500">{hint}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

// --- Mono / code chip ------------------------------------------------------

export function Mono({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <code
      className={cx(
        "rounded bg-zinc-800/70 px-1.5 py-0.5 font-mono text-xs text-zinc-300",
        className,
      )}
    >
      {children}
    </code>
  );
}

// re-export a Link-wrapping helper for nav usage
export { Link, cx };
export type { BadgeVariant };
