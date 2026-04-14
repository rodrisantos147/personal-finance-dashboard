"use client";

import { addMonths, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { Lightbulb, Plus } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  combinedPeriodTotalsReferenceUyu,
  compareToPreviousPeriod,
  currenciesInUse,
  debitVsCreditForReport,
  estimateFutureIncome,
  isUsingFallbackReferenceUyuPerUsd,
  filterByDateRange,
  monthlyBuckets,
  pendingTotals,
  sumIncomeExpenseForReport,
  transactionIncomeContributionInReport,
} from "@/lib/finance";
import { formatMoneyWithSettings } from "@/lib/format";
import { buildTips } from "@/lib/tips";
import { useFinanceStore } from "@/lib/store";
import { cn } from "@/lib/cn";
import { CreditCardsManager } from "./CreditCardsManager";
import { DataBackup } from "./DataBackup";
import { ExpensesConsumosPanel } from "./ExpensesConsumosPanel";
import { FinancialStateCard } from "./FinancialStateCard";
import { MovementsTable } from "./MovementsTable";
import { WishlistManager } from "./WishlistManager";
import { summarizeFinancialState } from "@/lib/financial-state";

/** Muestra variación % con un decimal y signo. */
function fmtDeltaPct(n: number) {
  if (n === 0) return "0%";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

/** Resumen, gráficos y KPI siempre en pesos uruguayos (incluye USD × TC referencia). */
const REPORT_CURRENCY = "UYU" as const;

export function FinanceDashboard() {
  const settings = useFinanceStore((s) => s.settings);
  const transactions = useFinanceStore((s) => s.transactions);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const recurringIncomes = useFinanceStore((s) => s.recurringIncomes);
  const [periodMonth, setPeriodMonth] = useState(() => startOfMonth(new Date()));

  const { from, to } = useMemo(
    () => ({ from: periodMonth, to: endOfMonth(periodMonth) }),
    [periodMonth],
  );

  const slice = useMemo(
    () => filterByDateRange(transactions, from, to),
    [transactions, from, to],
  );

  const usedCurrencies = useMemo(
    () => currenciesInUse(transactions, settings),
    [transactions, settings],
  );

  const { income, expense } = useMemo(
    () => sumIncomeExpenseForReport(slice, settings, REPORT_CURRENCY),
    [slice, settings],
  );
  const net = income - expense;

  const incomeAuditLines = useMemo(() => {
    return slice
      .map((t) => {
        const contribution = transactionIncomeContributionInReport(
          t,
          settings,
          REPORT_CURRENCY,
          slice,
        );
        return {
          id: t.id,
          desc: (t.description || "Sin detalle").slice(0, 56),
          contribution,
        };
      })
      .filter((x) => x.contribution > 0)
      .sort((a, b) => b.contribution - a.contribution);
  }, [slice, settings]);

  const referenceTotals = useMemo(() => {
    const fx = settings.referenceUyuPerUsd;
    if (fx == null || fx <= 0) return null;
    return combinedPeriodTotalsReferenceUyu(slice, settings, fx);
  }, [slice, settings]);

  const { pendingIncome, pendingExpense } = useMemo(
    () => pendingTotals(transactions, settings, REPORT_CURRENCY),
    [transactions, settings, REPORT_CURRENCY],
  );
  const horizon = endOfMonth(new Date());
  const future = useMemo(
    () =>
      estimateFutureIncome(
        transactions,
        recurringIncomes,
        horizon,
        settings,
        REPORT_CURRENCY,
      ),
    [transactions, recurringIncomes, horizon, settings, REPORT_CURRENCY],
  );

  const dv = useMemo(
    () => debitVsCreditForReport(slice, settings, REPORT_CURRENCY),
    [slice, settings, REPORT_CURRENCY],
  );

  const usingFallbackFx = useMemo(
    () => isUsingFallbackReferenceUyuPerUsd(settings, slice, REPORT_CURRENCY),
    [settings, slice, REPORT_CURRENCY],
  );
  const creditShare =
    expense > 0 ? dv.credit / expense : 0;
  const cardSpendDebitPlusCredit = dv.debit + dv.credit;

  const comparison = useMemo(
    () =>
      compareToPreviousPeriod(transactions, from, to, settings, REPORT_CURRENCY, {
        alignPreviousToCalendarMonth: true,
      }),
    [transactions, from, to, settings, REPORT_CURRENCY],
  );

  const chartAnchor = useMemo(() => endOfMonth(periodMonth), [periodMonth]);

  const barData = useMemo(
    () =>
      monthlyBuckets(
        transactions,
        6,
        settings,
        REPORT_CURRENCY,
        chartAnchor,
      ),
    [transactions, settings, REPORT_CURRENCY, chartAnchor],
  );

  const barChartScaleNote = useMemo(() => {
    if (barData.length < 2) return null;
    const last = barData[barData.length - 1];
    const prevSlices = barData.slice(0, -1);
    const prevMax = Math.max(
      0,
      ...prevSlices.flatMap((b) => [b.income, b.expense]),
    );
    const lastTotal = last.income + last.expense;
    if (prevMax <= 0 || lastTotal >= prevMax * 0.08) return null;
    return true;
  }, [barData]);

  const tips = useMemo(
    () =>
      buildTips({
        periodIncome: income,
        periodExpense: expense,
        creditExpenseShare: creditShare,
        pendingIncome,
        pendingExpense,
        futureIncomeEstimate: future.total,
        futureIncomeCurrency: REPORT_CURRENCY,
        locale: settings.locale,
        cards: creditCards,
      }),
    [
      income,
      expense,
      creditShare,
      pendingIncome,
      pendingExpense,
      future.total,
      REPORT_CURRENCY,
      settings.locale,
      creditCards,
    ],
  );

  const projectedSurplus =
    income - expense + pendingIncome - pendingExpense + future.total;

  const fmt = (n: number) =>
    formatMoneyWithSettings(n, settings, REPORT_CURRENCY);

  const fmtUyu = (n: number) => formatMoneyWithSettings(n, settings, "UYU");

  const financialState = useMemo(
    () =>
      summarizeFinancialState({
        net,
        income,
        expense,
        projectedSurplus,
        pendingIncome,
        pendingExpense,
        deltaIncomePct: comparison.deltaIncomePct,
        deltaExpensePct: comparison.deltaExpensePct,
        creditExpenseShare: creditShare,
        referenceNetUyu: referenceTotals?.net ?? null,
        hasReferenceFx: !!(
          settings.referenceUyuPerUsd && settings.referenceUyuPerUsd > 0
        ),
        movementsInPeriod: slice.length,
      }),
    [
      net,
      income,
      expense,
      projectedSurplus,
      pendingIncome,
      pendingExpense,
      comparison.deltaIncomePct,
      comparison.deltaExpensePct,
      creditShare,
      referenceTotals?.net,
      settings.referenceUyuPerUsd,
      slice.length,
    ],
  );

  const periodLabelForState = useMemo(
    () =>
      `${from.toLocaleDateString("es-UY", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })} — ${to.toLocaleDateString("es-UY", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`,
    [from, to],
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-8 pb-24 sm:px-6">
      <header className="border-b border-zinc-800 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Finanzas
        </h1>
        <p className="mt-2 max-w-lg text-sm text-zinc-400">
          Todo en pesos uruguayos. Los datos viven en este navegador; respaldo y
          tipo de cambio en{" "}
          <a
            href="#datos"
            className="text-zinc-300 underline underline-offset-2 hover:text-white"
          >
            Datos
          </a>
          .
        </p>
      </header>

      {process.env.NEXT_PUBLIC_SHOW_DEMO_BANNER === "true" && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-xl border border-zinc-600 bg-zinc-900/90 px-4 py-3 text-sm text-zinc-300 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            <span className="font-medium text-white">Demo:</span> dataset de
            ejemplo en{" "}
            <a
              href="#datos"
              className="font-medium text-white underline underline-offset-2 hover:text-zinc-200"
            >
              Datos
            </a>
            .
          </span>
        </div>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-zinc-500">Mes</span>
          <button
            type="button"
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
            onClick={() => setPeriodMonth((m) => subMonths(m, 1))}
          >
            ←
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
            →
          </button>
          <span className="text-xs text-zinc-500">
            {format(from, "d MMM yyyy")} — {format(to, "d MMM yyyy")}
          </span>
        </div>
        {slice.length === 0 && (
          <p className="mt-3 text-xs text-amber-200/90">
            No hay movimientos en este mes.
          </p>
        )}
      </section>

      <section id="resumen" className="scroll-mt-8 space-y-6">
        <FinancialStateCard
          state={financialState}
          periodLabel={periodLabelForState}
        />

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3">
          <p className="text-xs text-zinc-400">
            Resumen en <strong className="text-zinc-300">pesos uruguayos</strong>.
            USD se convierten con el tipo de cambio en{" "}
            <a
              href="#datos"
              className="text-zinc-300 underline underline-offset-2 hover:text-white"
            >
              Datos
            </a>{" "}
            (si no hay, se usa 42).
          </p>
          {usingFallbackFx && (
            <p className="mt-2 text-xs text-amber-100/90">
              Sin TC en Datos: se usa{" "}
              <strong className="text-amber-50">42 UYU/USD</strong> como
              referencia.
            </p>
          )}
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Ingresos del período"
              value={fmt(income)}
              hint={`vs mes anterior: ${fmtDeltaPct(comparison.deltaIncomePct)}`}
              detail={
                incomeAuditLines.length > 0 ? (
                  <ul className="max-h-28 space-y-1 overflow-y-auto text-left">
                    {incomeAuditLines.slice(0, 5).map((row) => (
                      <li
                        key={row.id}
                        className="flex items-baseline justify-between gap-2 border-b border-zinc-800/50 py-0.5 text-[11px] last:border-0"
                      >
                        <span className="min-w-0 flex-1 truncate text-zinc-500">
                          {row.desc}
                        </span>
                        <span className="shrink-0 tabular-nums text-zinc-400">
                          {fmt(row.contribution)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-zinc-600">
                    Sin ingresos en el mes (o excluidos del resumen).
                  </p>
                )
              }
              positive
            />
            <Kpi
              label="Gastos del período"
              value={fmt(expense)}
              hint={`vs mes anterior: ${fmtDeltaPct(comparison.deltaExpensePct)}`}
              detail={
                <span className="text-[11px] text-zinc-500">
                  Tarjetas: {fmt(cardSpendDebitPlusCredit)} · déb.{" "}
                  {fmt(dv.debit)} · créd. {fmt(dv.credit)} · otras:{" "}
                  {fmt(dv.other)}
                </span>
              }
            />
            <Kpi
              label="Resultado (ingresos − gastos)"
              value={fmt(net)}
              hint="Mes calendario seleccionado."
              positive={net >= 0}
            />
            <Kpi
              label="Pendientes (global)"
              value={`${fmt(pendingIncome)} / ${fmt(pendingExpense)}`}
              hint="Marcados como pendientes"
            />
          </section>

        {referenceTotals && (
            <div className="rounded-xl border border-dashed border-zinc-600/80 bg-zinc-950/50 px-4 py-3">
              <p className="text-xs font-medium text-zinc-500">
                Referencia UYU (USD ×{" "}
                {(settings.referenceUyuPerUsd ?? 0).toLocaleString("es-UY", {
                  maximumFractionDigits: 2,
                })}
                )
              </p>
              <p className="mt-2 text-lg font-semibold text-zinc-100">
                Resultado: {fmtUyu(referenceTotals.net)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Ingresos {fmtUyu(referenceTotals.income)} · Gastos{" "}
                {fmtUyu(referenceTotals.expense)}
              </p>
            </div>
          )}

        {!referenceTotals &&
            usedCurrencies.includes("UYU") &&
            usedCurrencies.includes("USD") && (
              <p className="text-xs text-zinc-600">
                <a
                  href="#datos"
                  className="text-zinc-400 underline hover:text-white"
                >
                  Cargá un tipo de cambio en Datos
                </a>{" "}
                para unificar pesos y dólares en un solo total.
              </p>
            )}

        <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="text-sm font-medium text-zinc-300">
                Ingresos futuros (hasta fin de mes)
              </h2>
              <p className="mt-3 text-3xl font-semibold text-white">
                {fmt(future.total)}
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Recurrentes {fmt(future.fromRecurring)} · pendientes{" "}
                {fmt(future.fromPending)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="text-sm font-medium text-zinc-300">
                Superávit proyectado
              </h2>
              <p className="mt-3 text-3xl font-semibold text-white">
                {fmt(projectedSurplus)}
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Neto del mes + pendientes + ingresos futuros (orientativo).
              </p>
            </div>
          </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-zinc-300">
              Últimos 6 meses
            </h2>
            <p className="mb-3 text-xs text-zinc-600">
              Pesos uruguayos (USD × TC en Datos si aplica). Última barra:{" "}
              {chartAnchor.toLocaleDateString("es-UY", {
                month: "long",
                year: "numeric",
              })}
              .
            </p>
            {barChartScaleNote && (
              <p className="mb-3 rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/90">
                Este mes el volumen es muy bajo respecto a meses anteriores: la
                última barra puede verse casi invisible.
              </p>
            )}
            <div className="h-72 w-full min-h-[288px] min-w-0">
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
          </section>

        <ExpensesConsumosPanel slice={slice} settings={settings} />
      </section>

      <section id="movimientos" className="scroll-mt-24 space-y-4 pt-12">
        <h2 className="text-lg font-semibold text-white">Movimientos</h2>
        <MovementsTable periodFrom={from} periodTo={to} />
      </section>

      <section id="tarjetas" className="scroll-mt-24 space-y-4 pt-12">
        <h2 className="text-lg font-semibold text-white">Tarjetas</h2>
        <CreditCardsManager />
      </section>

      <section id="deseos" className="scroll-mt-24 pt-12">
        <WishlistManager periodFrom={from} periodTo={to} />
      </section>

      <section id="consejos" className="scroll-mt-24 space-y-4 pt-12">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
          <Lightbulb className="h-5 w-5 shrink-0" aria-hidden />
          Consejos
        </h2>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-300">
            {tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </section>

      <section id="datos" className="scroll-mt-24 space-y-4 pt-12">
        <h2 className="text-lg font-semibold text-white">Datos</h2>
        <DataBackup />
      </section>

      <a
        href="#add"
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-white text-zinc-950 shadow-lg shadow-black/40 hover:bg-zinc-200"
        title="Agregar movimiento"
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
  detail,
  positive,
}: {
  label: string;
  value: string;
  hint?: string;
  detail?: ReactNode;
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
      {detail && (
        <div className="mt-2 text-[11px] leading-relaxed text-zinc-500">
          {detail}
        </div>
      )}
      {hint && <p className="mt-2 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
