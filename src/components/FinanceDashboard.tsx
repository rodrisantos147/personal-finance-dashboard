"use client";

import {
  addMonths,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";
import {
  CreditCard,
  LayoutDashboard,
  Lightbulb,
  ListTodo,
  Plus,
  Settings2,
  Table2,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  compareToPreviousPeriod,
  debitVsCredit,
  estimateFutureIncome,
  expensesByCategory,
  filterByDateRange,
  monthlyBuckets,
  pendingTotals,
  sumExpense,
  sumIncome,
} from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { buildTips } from "@/lib/tips";
import { useFinanceStore } from "@/lib/store";
import { cn } from "@/lib/cn";
import { CreditCardsManager } from "./CreditCardsManager";
import { DataBackup } from "./DataBackup";
import { MovementsTable } from "./MovementsTable";
import { WishlistManager } from "./WishlistManager";

type Tab = "overview" | "movements" | "cards" | "wishlist" | "tips" | "data";

const PIE_COLORS = ["#fafafa", "#d4d4d8", "#a1a1aa", "#71717a", "#52525b", "#3f3f46"];

export function FinanceDashboard() {
  const settings = useFinanceStore((s) => s.settings);
  const transactions = useFinanceStore((s) => s.transactions);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const recurringIncomes = useFinanceStore((s) => s.recurringIncomes);
  const [tab, setTab] = useState<Tab>("overview");
  const [periodMonth, setPeriodMonth] = useState(() => startOfMonth(new Date()));
  const [rangeMode, setRangeMode] = useState<"month" | "custom">("month");
  const [customFrom, setCustomFrom] = useState(
    () => format(startOfMonth(new Date()), "yyyy-MM-dd"),
  );
  const [customTo, setCustomTo] = useState(
    () => format(endOfMonth(new Date()), "yyyy-MM-dd"),
  );

  const { from, to } = useMemo(() => {
    if (rangeMode === "month") {
      return { from: periodMonth, to: endOfMonth(periodMonth) };
    }
    return {
      from: new Date(customFrom),
      to: endOfMonth(new Date(customTo)),
    };
  }, [rangeMode, periodMonth, customFrom, customTo]);

  const slice = useMemo(
    () => filterByDateRange(transactions, from, to),
    [transactions, from, to],
  );

  const income = useMemo(() => sumIncome(slice), [slice]);
  const expense = useMemo(() => sumExpense(slice), [slice]);
  const net = income - expense;
  const { pendingIncome, pendingExpense } = useMemo(
    () => pendingTotals(transactions),
    [transactions],
  );
  const horizon = endOfMonth(new Date());
  const future = useMemo(
    () => estimateFutureIncome(transactions, recurringIncomes, horizon),
    [transactions, recurringIncomes, horizon],
  );

  const categoryData = useMemo(() => expensesByCategory(slice), [slice]);
  const dv = useMemo(() => debitVsCredit(slice), [slice]);
  const creditShare =
    expense > 0 ? dv.credit / expense : 0;

  const comparison = useMemo(
    () => compareToPreviousPeriod(transactions, from, to),
    [transactions, from, to],
  );

  const barData = useMemo(() => monthlyBuckets(transactions, 6), [transactions]);

  const tips = useMemo(
    () =>
      buildTips({
        periodIncome: income,
        periodExpense: expense,
        creditExpenseShare: creditShare,
        pendingIncome,
        pendingExpense,
        futureIncomeEstimate: future.total,
        cards: creditCards,
      }),
    [
      income,
      expense,
      creditShare,
      pendingIncome,
      pendingExpense,
      future.total,
      creditCards,
    ],
  );

  const projectedSurplus =
    income - expense + pendingIncome - pendingExpense + future.total;

  const fmt = (n: number) => formatMoney(n, settings);

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-8 pb-24 sm:px-6">
      <header className="flex flex-col gap-4 border-b border-zinc-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
            Finanzas personales
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-400">
            Ingresos y egresos, comparativas, tarjetas, lista de deseos y
            consejos. Los datos se guardan en este navegador; podés exportar un
            respaldo desde Datos.
          </p>
        </div>
      </header>

      {process.env.NEXT_PUBLIC_SHOW_DEMO_BANNER === "true" && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-xl border border-zinc-600 bg-zinc-900/90 px-4 py-3 text-sm text-zinc-300 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            <span className="font-medium text-white">Demo para clientes:</span>{" "}
            cargá datos ficticios desde Datos para mostrar el producto con
            gráficas llenas.
          </span>
          <button
            type="button"
            onClick={() => setTab("data")}
            className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-zinc-950 hover:bg-zinc-200"
          >
            Ir a Datos
          </button>
        </div>
      )}

      <section className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">Período</span>
          <div className="flex rounded-lg border border-zinc-700 bg-zinc-900 p-0.5">
            <button
              type="button"
              onClick={() => setRangeMode("month")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition",
                rangeMode === "month"
                  ? "bg-white text-zinc-950"
                  : "text-zinc-400 hover:text-white",
              )}
            >
              Mes
            </button>
            <button
              type="button"
              onClick={() => setRangeMode("custom")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition",
                rangeMode === "custom"
                  ? "bg-white text-zinc-950"
                  : "text-zinc-400 hover:text-white",
              )}
            >
              Rango
            </button>
          </div>
        </div>
        {rangeMode === "month" ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              onClick={() => setPeriodMonth((m) => subMonths(m, 1))}
            >
              ← Mes anterior
            </button>
            <input
              type="month"
              value={format(periodMonth, "yyyy-MM")}
              onChange={(e) => {
                const [y, mo] = e.target.value.split("-").map(Number);
                setPeriodMonth(new Date(y, mo - 1, 1));
              }}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              onClick={() => setPeriodMonth((m) => addMonths(m, 1))}
            >
              Mes siguiente →
            </button>
            <span className="text-xs text-zinc-500">
              {format(from, "d MMM yyyy")} — {format(to, "d MMM yyyy")}
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              Desde
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              Hasta
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
              />
            </label>
          </div>
        )}
      </section>

      <nav className="flex flex-wrap gap-2">
        {(
          [
            ["overview", "Resumen", LayoutDashboard],
            ["movements", "Movimientos", Table2],
            ["cards", "Tarjetas", CreditCard],
            ["wishlist", "Lista de deseos", ListTodo],
            ["tips", "Consejos", Lightbulb],
            ["data", "Datos", Settings2],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
              tab === id
                ? "border-white bg-white text-zinc-950"
                : "border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Ingresos del período"
              value={fmt(income)}
              hint={`vs período anterior: ${comparison.deltaIncomePct >= 0 ? "+" : ""}${comparison.deltaIncomePct}%`}
              positive
            />
            <Kpi
              label="Gastos del período"
              value={fmt(expense)}
              hint={`vs período anterior: ${comparison.deltaExpensePct >= 0 ? "+" : ""}${comparison.deltaExpensePct}%`}
            />
            <Kpi
              label="Resultado (ingresos − gastos)"
              value={fmt(net)}
              hint="Solo movimientos con fecha en el período"
              positive={net >= 0}
            />
            <Kpi
              label="Pendientes (global)"
              value={`${fmt(pendingIncome)} / ${fmt(pendingExpense)}`}
              hint="Ingresos y egresos marcados como pendientes"
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="text-sm font-medium text-zinc-300">
                Ingresos futuros estimados (hasta fin de mes)
              </h2>
              <p className="mt-3 text-3xl font-semibold text-white">
                {fmt(future.total)}
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Recurrentes: {fmt(future.fromRecurring)} · Pendientes con fecha
                futura: {fmt(future.fromPending)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="text-sm font-medium text-zinc-300">
                Superávit proyectado (referencia para compras)
              </h2>
              <p className="mt-3 text-3xl font-semibold text-white">
                {fmt(projectedSurplus)}
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Período actual neto + pendientes + ingresos futuros estimados.
                Es orientativo.
              </p>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="mb-4 text-sm font-medium text-zinc-300">
                Últimos 6 meses — ingresos vs gastos
              </h2>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="label" stroke="#71717a" fontSize={11} />
                    <YAxis stroke="#71717a" fontSize={11} />
                    <Tooltip
                      formatter={(v) =>
                        fmt(typeof v === "number" ? v : Number(v))
                      }
                      contentStyle={{
                        background: "#18181b",
                        border: "1px solid #27272a",
                        borderRadius: 8,
                      }}
                    />
                    <Legend />
                    <Bar dataKey="income" name="Ingresos" fill="#fafafa" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="Gastos" fill="#52525b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="mb-4 text-sm font-medium text-zinc-300">
                Gastos por categoría (período seleccionado)
              </h2>
              <div className="h-72 w-full">
                {categoryData.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No hay gastos en este período.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={2}
                        label={false}
                      >
                        {categoryData.map((_, i) => (
                          <Cell
                            key={categoryData[i].name}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) =>
                          fmt(typeof v === "number" ? v : Number(v))
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="mb-4 text-sm font-medium text-zinc-300">
              Gastos: débito vs crédito vs otros (período)
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-zinc-500">Débito</p>
                <p className="text-xl font-semibold">{fmt(dv.debit)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Crédito</p>
                <p className="text-xl font-semibold">{fmt(dv.credit)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Efectivo / transferencia</p>
                <p className="text-xl font-semibold">{fmt(dv.other)}</p>
              </div>
            </div>
          </section>
        </>
      )}

      {tab === "movements" && <MovementsTable periodFrom={from} periodTo={to} />}

      {tab === "cards" && <CreditCardsManager />}

      {tab === "wishlist" && (
        <WishlistManager projectedSurplus={projectedSurplus} />
      )}

      {tab === "tips" && (
        <section className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h2 className="flex items-center gap-2 text-lg font-medium text-white">
              <Lightbulb className="h-5 w-5" />
              Consejos según tus números
            </h2>
            <ul className="mt-4 list-disc space-y-3 pl-5 text-sm text-zinc-300">
              {tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/20 p-4 text-sm text-zinc-500">
            Nada aquí reemplaza asesoramiento profesional. Ajustá categorías y
            cargá cierres de tarjeta para alertas más útiles.
          </div>
        </section>
      )}

      {tab === "data" && <DataBackup />}

      <a
        href="#add"
        onClick={(e) => {
          e.preventDefault();
          setTab("movements");
        }}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-white text-zinc-950 shadow-lg shadow-black/40 hover:bg-zinc-200"
        title="Ir a movimientos"
      >
        <Plus className="h-7 w-7" />
      </a>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  positive,
}: {
  label: string;
  value: string;
  hint?: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tracking-tight",
          positive === true && "text-emerald-400",
          positive === false && "text-rose-400",
          positive === undefined && "text-white",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
