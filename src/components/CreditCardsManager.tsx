"use client";

import {
  fallbackDaysFromSchedule,
  ITAU_STYLE_2026_SCHEDULE,
} from "@/lib/card-schedules";
import { daysUntil, nextClosingDate, nextDueDate } from "@/lib/finance";
import { useFinanceStore } from "@/lib/store";

const MES_CORTO = [
  "",
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Oct",
  "Nov",
  "Dic",
];

export function CreditCardsManager() {
  const creditCards = useFinanceStore((s) => s.creditCards);
  const addCreditCard = useFinanceStore((s) => s.addCreditCard);
  const updateCreditCard = useFinanceStore((s) => s.updateCreditCard);
  const removeCreditCard = useFinanceStore((s) => s.removeCreditCard);

  const now = new Date();

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="text-lg font-medium text-white">Agregar tarjeta</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Si el banco te da una tabla con fechas distintas cada mes, usá el
          botón de calendario 2026. Si no, alcanza con el día fijo de cierre y
          vencimiento.
        </p>
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

        <div className="mt-4 flex flex-wrap gap-3 border-t border-zinc-800 pt-4">
          <button
            type="button"
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
            onClick={() => {
              const name =
                prompt("Nombre de la tarjeta", "Tarjeta crédito")?.trim() ||
                "Tarjeta crédito";
              const fb = fallbackDaysFromSchedule(ITAU_STYLE_2026_SCHEDULE);
              addCreditCard({
                name,
                closingDay: fb.closingDay,
                dueDay: fb.dueDay,
                annualSchedule: [...ITAU_STYLE_2026_SCHEDULE],
              });
            }}
          >
            Añadir con calendario 2026 (tabla Itaú)
          </button>
        </div>
      </section>

      <section className="space-y-4">
        {creditCards.length === 0 && (
          <p className="text-sm text-zinc-500">
            Aún no cargaste tarjetas. Los cierres y vencimientos alimentan los
            consejos y recordatorios.
          </p>
        )}
        {creditCards.map((c) => {
          const close = nextClosingDate(c, now);
          const due = nextDueDate(c, now);
          return (
            <div
              key={c.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
                      {due.toLocaleDateString("es-AR")} (
                      {daysUntil(due, now)} días)
                    </span>
                  </p>
                  {!c.annualSchedule?.length && (
                    <p className="mt-2 text-xs text-zinc-600">
                      Día fijo: cierre {c.closingDay}, vencimiento {c.dueDay}{" "}
                      de cada mes.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!c.annualSchedule?.length ? (
                    <button
                      type="button"
                      className="rounded-lg border border-emerald-800/60 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-950/30"
                      onClick={() => {
                        const fb =
                          fallbackDaysFromSchedule(ITAU_STYLE_2026_SCHEDULE);
                        updateCreditCard(c.id, {
                          closingDay: fb.closingDay,
                          dueDay: fb.dueDay,
                          annualSchedule: [...ITAU_STYLE_2026_SCHEDULE],
                        });
                      }}
                    >
                      Cargar calendario 2026
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
                      onClick={() => {
                        if (
                          confirm(
                            "¿Quitar el calendario y volver a día fijo mensual?",
                          )
                        ) {
                          updateCreditCard(c.id, { annualSchedule: undefined });
                        }
                      }}
                    >
                      Quitar calendario
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                    onClick={() => {
                      const name = prompt("Nombre", c.name);
                      if (name === null) return;
                      const closing = Number(
                        prompt("Día de cierre por defecto (1-31)", String(c.closingDay)),
                      );
                      const dueD = Number(
                        prompt("Día de vencimiento por defecto (1-31)", String(c.dueDay)),
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
                    Editar nombre / días base
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

              {c.annualSchedule && c.annualSchedule.length > 0 && (
                <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-800">
                  <table className="w-full min-w-[360px] text-left text-xs">
                    <thead className="bg-zinc-950 text-zinc-500">
                      <tr>
                        <th className="px-3 py-2">Mes</th>
                        <th className="px-3 py-2">Cierre</th>
                        <th className="px-3 py-2">Vencimiento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800 text-zinc-300">
                      {c.annualSchedule
                        .slice()
                        .sort((a, b) =>
                          a.year !== b.year
                            ? a.year - b.year
                            : a.month - b.month,
                        )
                        .map((row) => (
                          <tr key={`${row.year}-${row.month}`}>
                            <td className="px-3 py-1.5">
                              {MES_CORTO[row.month]} {row.year}
                            </td>
                            <td className="px-3 py-1.5 tabular-nums">
                              {String(row.closingDay).padStart(2, "0")}/
                              {String(row.month).padStart(2, "0")}/{row.year}
                            </td>
                            <td className="px-3 py-1.5 tabular-nums">
                              {String(row.dueDay).padStart(2, "0")}/
                              {String(row.month).padStart(2, "0")}/{row.year}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
