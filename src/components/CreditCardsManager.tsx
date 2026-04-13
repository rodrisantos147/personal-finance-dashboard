"use client";

import { useMemo } from "react";
import { daysUntil, nextClosingDate, nextDueDate } from "@/lib/finance";
import { useFinanceStore } from "@/lib/store";

export function CreditCardsManager() {
  const creditCards = useFinanceStore((s) => s.creditCards);
  const addCreditCard = useFinanceStore((s) => s.addCreditCard);
  const updateCreditCard = useFinanceStore((s) => s.updateCreditCard);
  const removeCreditCard = useFinanceStore((s) => s.removeCreditCard);

  const now = useMemo(() => new Date(), []);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="text-lg font-medium text-white">Agregar tarjeta</h2>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const name = String(fd.get("name") || "").trim();
            const closing = Number(fd.get("closing"));
            const due = Number(fd.get("due"));
            if (!name || closing < 1 || closing > 31 || due < 1 || due > 31)
              return;
            addCreditCard({ name, closingDay: closing, dueDay: due });
            e.currentTarget.reset();
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Nombre</span>
            <input
              name="name"
              required
              placeholder="Visa, Mastercard…"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Día de cierre</span>
            <input
              name="closing"
              type="number"
              min={1}
              max={31}
              required
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Día de vencimiento</span>
            <input
              name="due"
              type="number"
              min={1}
              max={31}
              required
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
            >
              Guardar
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        {creditCards.length === 0 && (
          <p className="text-sm text-zinc-500">
            Aún no cargaste tarjetas. Los días de cierre y vencimiento sirven
            para recordatorios y para asociar compras con crédito.
          </p>
        )}
        {creditCards.map((c) => {
          const close = nextClosingDate(c, now);
          const due = nextDueDate(c, now);
          return (
            <div
              key={c.id}
              className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h3 className="font-medium text-white">{c.name}</h3>
                <p className="mt-1 text-sm text-zinc-500">
                  Próximo cierre:{" "}
                  <span className="text-zinc-300">
                    {close.toLocaleDateString("es-AR")} (
                    {daysUntil(close, now)} días)
                  </span>
                </p>
                <p className="text-sm text-zinc-500">
                  Próximo vencimiento:{" "}
                  <span className="text-zinc-300">
                    {due.toLocaleDateString("es-AR")} ({daysUntil(due, now)}{" "}
                    días)
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                  onClick={() => {
                    const name = prompt("Nombre", c.name);
                    if (name === null) return;
                    const closing = Number(
                      prompt("Día de cierre (1-31)", String(c.closingDay)),
                    );
                    const dueD = Number(
                      prompt("Día de vencimiento (1-31)", String(c.dueDay)),
                    );
                    if (
                      !Number.isFinite(closing) ||
                      !Number.isFinite(dueD) ||
                      closing < 1 ||
                      closing > 31 ||
                      dueD < 1 ||
                      dueD > 31
                    )
                      return;
                    updateCreditCard(c.id, {
                      name: name.trim() || c.name,
                      closingDay: closing,
                      dueDay: dueD,
                    });
                  }}
                >
                  Editar
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-rose-900/50 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-950/40"
                  onClick={() => removeCreditCard(c.id)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
