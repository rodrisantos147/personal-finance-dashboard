"use client";

import { Wallet } from "lucide-react";
import type { FinancialStateSummary } from "@/lib/financial-state";
import { cn } from "@/lib/cn";

const variantClass: Record<
  FinancialStateSummary["variant"],
  { border: string; badge: string; icon: string }
> = {
  positive: {
    border: "border-emerald-500/25 bg-emerald-950/15",
    badge: "bg-emerald-500/15 text-emerald-300",
    icon: "text-emerald-400/90",
  },
  balanced: {
    border: "border-zinc-600/80 bg-zinc-900/50",
    badge: "bg-zinc-700/80 text-zinc-300",
    icon: "text-zinc-400",
  },
  caution: {
    border: "border-amber-500/25 bg-amber-950/15",
    badge: "bg-amber-500/15 text-amber-200",
    icon: "text-amber-400/90",
  },
  negative: {
    border: "border-rose-500/25 bg-rose-950/15",
    badge: "bg-rose-500/15 text-rose-200",
    icon: "text-rose-400/90",
  },
};

export function FinancialStateCard({
  state,
  periodLabel,
}: {
  state: FinancialStateSummary;
  periodLabel: string;
}) {
  const v = variantClass[state.variant];

  return (
    <section
      className={cn(
        "rounded-xl border px-4 py-4 sm:px-5 sm:py-5",
        v.border,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-zinc-950/50",
            v.icon,
          )}
        >
          <Wallet className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 gap-y-1">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Tu estado financiero
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                v.badge,
              )}
            >
              {state.label}
            </span>
            <span className="text-[11px] text-zinc-600">{periodLabel}</span>
          </div>
          <h2 className="mt-2 text-base font-semibold leading-snug text-white sm:text-lg">
            {state.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            {state.description}
          </p>
          {state.bullets.length > 0 && (
            <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm text-zinc-500">
              {state.bullets.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-zinc-600">
            Ingresos, gastos y proyección se interpretan según la{" "}
            <strong className="font-medium text-zinc-500">moneda del resumen</strong>{" "}
            y el período arriba. La referencia UYU+USD usa tu tipo de cambio en Datos.
          </p>
        </div>
      </div>
    </section>
  );
}
