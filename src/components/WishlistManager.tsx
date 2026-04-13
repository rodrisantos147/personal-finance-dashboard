"use client";

import { useMemo, useState } from "react";
import { projectedSurplusForPeriod } from "@/lib/finance";
import { formatMoneyWithSettings, resolveDefaultCurrency } from "@/lib/format";
import { useFinanceStore } from "@/lib/store";
import type { CurrencyCode, WishlistPriority } from "@/lib/types";
import { evaluateWishlistItem } from "@/lib/wishlist-logic";
import { cn } from "@/lib/cn";

const PRIORITIES: { id: WishlistPriority; label: string }[] = [
  { id: "high", label: "Alta" },
  { id: "medium", label: "Media" },
  { id: "low", label: "Baja" },
];

const WISH_CUR: { id: CurrencyCode; label: string }[] = [
  { id: "UYU", label: "UYU" },
  { id: "USD", label: "USD" },
];

export function WishlistManager({
  periodFrom,
  periodTo,
}: {
  periodFrom: Date;
  periodTo: Date;
}) {
  const settings = useFinanceStore((s) => s.settings);
  const transactions = useFinanceStore((s) => s.transactions);
  const recurringIncomes = useFinanceStore((s) => s.recurringIncomes);
  const wishlist = useFinanceStore((s) => s.wishlist);
  const addWishlist = useFinanceStore((s) => s.addWishlist);
  const removeWishlist = useFinanceStore((s) => s.removeWishlist);

  const [name, setName] = useState("");
  const [estimate, setEstimate] = useState("");
  const [priority, setPriority] = useState<WishlistPriority>("medium");
  const [notes, setNotes] = useState("");
  const [wishCurrency, setWishCurrency] = useState<CurrencyCode>(() =>
    resolveDefaultCurrency(settings),
  );

  const fmt = (n: number, c: CurrencyCode) =>
    formatMoneyWithSettings(n, settings, c);

  const sorted = useMemo(() => {
    return [...wishlist].sort((a, b) => b.estimate - a.estimate);
  }, [wishlist]);

  const monthlyExtraByCur = useMemo(() => {
    const def = resolveDefaultCurrency(settings);
    const out: Partial<Record<CurrencyCode, number>> = {};
    for (const r of recurringIncomes) {
      if (!r.active) continue;
      const c = r.currency ?? def;
      out[c] = (out[c] ?? 0) + r.amount;
    }
    return out;
  }, [recurringIncomes, settings]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="text-lg font-medium text-white">Lista de deseos</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Cada ítem tiene moneda (UYU o USD). El veredicto usa el superávit
          proyectado en esa moneda. Recurrentes activos:{" "}
          {Object.entries(monthlyExtraByCur)
            .map(([c, n]) => `${fmt(n, c as CurrencyCode)}/${c}`)
            .join(" · ") || "—"}
        </p>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(estimate.replace(",", "."));
            if (!name.trim() || !Number.isFinite(n) || n <= 0) return;
            addWishlist({
              name: name.trim(),
              estimate: n,
              priority,
              notes: notes.trim(),
              currency: wishCurrency,
            });
            setName("");
            setEstimate("");
            setNotes("");
          }}
        >
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-zinc-400">Qué querés comprar</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Presupuesto estimado</span>
            <input
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Moneda del presupuesto</span>
            <select
              value={wishCurrency}
              onChange={(e) =>
                setWishCurrency(e.target.value as CurrencyCode)
              }
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            >
              {WISH_CUR.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Prioridad</span>
            <select
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value as WishlistPriority)
              }
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            >
              {PRIORITIES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-zinc-400">Notas (opcional)</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-white px-6 py-2.5 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
            >
              Añadir a la lista
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        {sorted.length === 0 && (
          <p className="text-sm text-zinc-500">La lista está vacía.</p>
        )}
        {sorted.map((item) => {
          const cur = item.currency ?? resolveDefaultCurrency(settings);
          const surplus = projectedSurplusForPeriod(
            transactions,
            recurringIncomes,
            settings,
            cur,
            periodFrom,
            periodTo,
          );
          const ev = evaluateWishlistItem(item, surplus);
          return (
            <div
              key={item.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-medium text-white">{item.name}</h3>
                  <p className="text-sm text-zinc-400">
                    {fmt(item.estimate, cur)}{" "}
                    <span className="text-zinc-600">({cur})</span>
                  </p>
                  {item.notes && (
                    <p className="mt-2 text-sm text-zinc-500">{item.notes}</p>
                  )}
                </div>
                <button
                  type="button"
                  className="text-xs text-zinc-500 hover:text-rose-400"
                  onClick={() => removeWishlist(item.id)}
                >
                  Quitar
                </button>
              </div>
              <div
                className={cn(
                  "mt-3 rounded-lg border px-3 py-2 text-sm",
                  ev.verdict === "ideal" &&
                    "border-emerald-800/80 bg-emerald-950/30 text-emerald-200",
                  ev.verdict === "ok" &&
                    "border-amber-800/80 bg-amber-950/30 text-amber-200",
                  ev.verdict === "wait" &&
                    "border-zinc-700 bg-zinc-950/60 text-zinc-400",
                )}
              >
                <span className="font-medium">
                  {ev.verdict === "ideal" && "Buen momento posible"}
                  {ev.verdict === "ok" && "Evaluar con cuidado"}
                  {ev.verdict === "wait" && "Mejor esperar"}
                </span>
                <p className="mt-1 text-xs opacity-90">{ev.detail}</p>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
