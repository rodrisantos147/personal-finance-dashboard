"use client";

import { useMemo, useState } from "react";
import { filterByDateRange } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { useFinanceStore } from "@/lib/store";
import type { PaymentMethod, TransactionType } from "@/lib/types";
import { cn } from "@/lib/cn";

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "debit", label: "Débito" },
  { id: "credit", label: "Crédito" },
  { id: "cash", label: "Efectivo" },
  { id: "transfer", label: "Transferencia" },
];

export function MovementsTable({
  periodFrom,
  periodTo,
}: {
  periodFrom: Date;
  periodTo: Date;
}) {
  const settings = useFinanceStore((s) => s.settings);
  const transactions = useFinanceStore((s) => s.transactions);
  const expenseCategories = useFinanceStore((s) => s.expenseCategories);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const removeTransaction = useFinanceStore((s) => s.removeTransaction);
  const addExpenseCategory = useFinanceStore((s) => s.addExpenseCategory);

  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Otros");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("debit");
  const [cardId, setCardId] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [newCat, setNewCat] = useState("");

  const slice = useMemo(
    () => filterByDateRange(transactions, periodFrom, periodTo),
    [transactions, periodFrom, periodTo],
  );

  const fmt = (n: number) => formatMoney(n, settings);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return;
    addTransaction({
      type,
      amount: n,
      category: type === "expense" ? category : "Ingreso",
      date: new Date(date).toISOString(),
      paymentMethod: type === "expense" ? paymentMethod : "transfer",
      cardId:
        type === "expense" && paymentMethod === "credit" && cardId
          ? cardId
          : undefined,
      description: description.trim() || "Sin descripción",
      isPending,
    });
    setAmount("");
    setDescription("");
    setIsPending(false);
  }

  return (
    <div id="add" className="space-y-8 scroll-mt-24">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="text-lg font-medium text-white">Nuevo movimiento</h2>
        <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Tipo</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TransactionType)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            >
              <option value="income">Ingreso</option>
              <option value="expense">Egreso</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Monto</span>
            <input
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Fecha</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            />
          </label>

          {type === "expense" && (
            <>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-zinc-400">Categoría</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
                >
                  {expenseCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-400">Nueva categoría</span>
                <div className="flex gap-2">
                  <input
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    placeholder="Nombre"
                    className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-zinc-600 px-3 py-2 text-xs text-white hover:bg-zinc-800"
                    onClick={() => {
                      addExpenseCategory(newCat);
                      setCategory(newCat.trim());
                      setNewCat("");
                    }}
                  >
                    Añadir
                  </button>
                </div>
              </div>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-zinc-400">Medio de pago</span>
                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as PaymentMethod)
                  }
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
                >
                  {METHODS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              {paymentMethod === "credit" && creditCards.length > 0 && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-zinc-400">Tarjeta</span>
                  <select
                    value={cardId}
                    onChange={(e) => setCardId(e.target.value)}
                    className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
                  >
                    <option value="">—</option>
                    {creditCards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}

          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-zinc-400">Descripción</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-zinc-300 sm:col-span-3">
            <input
              type="checkbox"
              checked={isPending}
              onChange={(e) => setIsPending(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-600"
            />
            Pendiente (aún no cobrado / no pagado)
          </label>

          <div className="sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              className="rounded-lg bg-white px-6 py-2.5 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
            >
              Guardar movimiento
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-medium text-zinc-300">
            Movimientos en el período seleccionado ({slice.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-zinc-950/80 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Medio</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {slice.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                    No hay movimientos en este período.
                  </td>
                </tr>
              )}
              {slice.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-900/80">
                  <td className="px-4 py-3 text-zinc-400">
                    {new Date(t.date).toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        t.type === "income"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-rose-500/15 text-rose-300",
                      )}
                    >
                      {t.type === "income" ? "Ingreso" : "Egreso"}
                    </span>
                    {t.isPending && (
                      <span className="ml-2 text-xs text-amber-400">pend.</span>
                    )}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-zinc-200">
                    {t.description}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{t.category}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {t.type === "expense"
                      ? METHODS.find((m) => m.id === t.paymentMethod)?.label
                      : "—"}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-medium tabular-nums",
                      t.type === "income" ? "text-emerald-400" : "text-rose-300",
                    )}
                  >
                    {t.type === "income" ? "+" : "−"}
                    {fmt(t.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="text-xs text-zinc-500 hover:text-rose-400"
                      onClick={() => removeTransaction(t.id)}
                    >
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
