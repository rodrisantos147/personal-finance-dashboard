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
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  combinedExpenseByPaymentReferenceUyu,
  combinedPeriodTotalsReferenceUyu,
  compareToPreviousPeriod,
  currenciesInUse,
  debitVsCredit,
  estimateFutureIncome,
  filterByDateRange,
  monthlyBuckets,
  pendingTotals,
  sumIncomeExpenseForReport,
} from "@/lib/finance";
import { formatMoneyWithSettings, resolveDefaultCurrency } from "@/lib/format";
import type { CurrencyCode } from "@/lib/types";
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

type Tab = "overview" | "movements" | "cards" | "wishlist" | "tips" | "data";

/** Muestra variación % con un decimal y signo. */
function fmtDeltaPct(n: number) {
  if (n === 0) return "0%";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

const REPORT_CURRENCIES: { id: CurrencyCode; label: string }[] = [
  { id: "UYU", label: "Pesos (UYU)" },
  { id: "USD", label: "Dólares (USD)" },
];

export function FinanceDashboard() {
  const settings = useFinanceStore((s) => s.settings);
  const transactions = useFinanceStore((s) => s.transactions);
  const creditCards = useFinanceStore((s) => s.creditCards);
  const recurringIncomes = useFinanceStore((s) => s.recurringIncomes);
  const [tab, setTab] = useState<Tab>("overview");
  const [reportCurrency, setReportCurrency] = useState<CurrencyCode>(() =>
    resolveDefaultCurrency(settings),
  );
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

  const usedCurrencies = useMemo(
    () => currenciesInUse(transactions, settings),
    [transactions, settings],
  );

  useEffect(() => {
    if (!usedCurrencies.includes(reportCurrency)) {
      setReportCurrency(usedCurrencies[0] ?? resolveDefaultCurrency(settings));
    }
  }, [usedCurrencies, reportCurrency, settings]);

  const { income, expense } = useMemo(
    () => sumIncomeExpenseForReport(slice, settings, reportCurrency),
    [slice, settings, reportCurrency],
  );
  const net = income - expense;

  const referenceTotals = useMemo(() => {
    const fx = settings.referenceUyuPerUsd;
    if (fx == null || fx <= 0) return null;
    return combinedPeriodTotalsReferenceUyu(slice, settings, fx);
  }, [slice, settings]);

  const referenceExpenseByPay = useMemo(() => {
    const fx = settings.referenceUyuPerUsd;
    if (fx == null || fx <= 0) return null;
    return combinedExpenseByPaymentReferenceUyu(slice, settings, fx);
  }, [slice, settings]);

  const { pendingIncome, pendingExpense } = useMemo(
    () => pendingTotals(transactions, settings, reportCurrency),
    [transactions, settings, reportCurrency],
  );
  const horizon = endOfMonth(new Date());
  const future = useMemo(
    () =>
      estimateFutureIncome(
        transactions,
        recurringIncomes,
        horizon,
        settings,
        reportCurrency,
      ),
    [transactions, recurringIncomes, horizon, settings, reportCurrency],
  );

  const dv = useMemo(
    () => debitVsCredit(slice, settings, reportCurrency),
    [slice, settings, reportCurrency],
  );
  const creditShare =
    expense > 0 ? dv.credit / expense : 0;
  const cardSpendDebitPlusCredit = dv.debit + dv.credit;

  const comparison = useMemo(
    () =>
      compareToPreviousPeriod(transactions, from, to, settings, reportCurrency),
    [transactions, from, to, settings, reportCurrency],
  );

  const chartAnchor = useMemo(() => {
    if (rangeMode === "month") return endOfMonth(periodMonth);
    return endOfMonth(to);
  }, [rangeMode, periodMonth, to]);

  const barData = useMemo(
    () =>
      monthlyBuckets(
        transactions,
        6,
        settings,
        reportCurrency,
        chartAnchor,
      ),
    [transactions, settings, reportCurrency, chartAnchor],
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
        futureIncomeCurrency: reportCurrency,
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
      reportCurrency,
      settings.locale,
      creditCards,
    ],
  );

  const projectedSurplus =
    income - expense + pendingIncome - pendingExpense + future.total;

  const fmt = (n: number) =>
    formatMoneyWithSettings(n, settings, reportCurrency);

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
            <p className="w-full text-xs leading-relaxed text-zinc-500">
              Con <strong className="text-zinc-400">Mes</strong>, el período de los
              KPI y tablas es el <strong className="text-zinc-400">mes calendario
              completo</strong> seleccionado (del 1 al último día de ese mes), no un
              mes “desde hoy”.
            </p>
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
            <p className="w-full text-xs leading-relaxed text-zinc-500">
              Con <strong className="text-zinc-400">Rango</strong>, se incluyen
              movimientos entre la fecha &quot;Desde&quot; y el{" "}
              <strong className="text-zinc-400">fin del mes</strong> de
              &quot;Hasta&quot;.
            </p>
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
          <FinancialStateCard
            state={financialState}
            periodLabel={periodLabelForState}
          />

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3">
            <span className="text-xs font-medium text-zinc-500">
              Moneda del resumen y gráficos
            </span>
            <select
              value={reportCurrency}
              onChange={(e) =>
                setReportCurrency(e.target.value as CurrencyCode)
              }
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              {REPORT_CURRENCIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-zinc-600">
              Con datos: {usedCurrencies.join(", ") || "—"}
            </span>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Ingresos del período"
              value={fmt(income)}
              hint={`vs período anterior: ${fmtDeltaPct(comparison.deltaIncomePct)}`}
              positive
            />
            <Kpi
              label="Gastos del período"
              value={fmt(expense)}
              hint={`vs período anterior: ${fmtDeltaPct(comparison.deltaExpensePct)}`}
              detail={
                <>
                  <span className="font-medium text-zinc-300">
                    Tarjetas (débito + crédito): {fmt(cardSpendDebitPlusCredit)}
                  </span>
                  <span className="mt-1 block text-zinc-400">
                    Desglose: débito {fmt(dv.debit)} · crédito {fmt(dv.credit)} ·
                    efect./transf. {fmt(dv.other)}
                  </span>
                  <span className="mt-1.5 block text-[11px] leading-snug text-zinc-600">
                    El total de tarjetas suma ambos medios. El desglose depende de cómo
                    cargaste cada movimiento en Movimientos.
                  </span>
                </>
              }
            />
            <Kpi
              label="Resultado (ingresos − gastos)"
              value={fmt(net)}
              hint="Solo movimientos con fecha dentro del período de arriba (mes completo o rango)"
              positive={net >= 0}
            />
            <Kpi
              label="Pendientes (global)"
              value={`${fmt(pendingIncome)} / ${fmt(pendingExpense)}`}
              hint="Ingresos y egresos marcados como pendientes"
            />
          </section>

          {referenceTotals && (
            <div className="rounded-xl border border-dashed border-zinc-600/80 bg-zinc-950/50 px-4 py-3">
              <p className="text-xs font-medium text-zinc-500">
                Referencia combinada (todo en UYU; USD ×{" "}
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
              {referenceExpenseByPay && (
                <p className="mt-1 text-xs text-zinc-600">
                  Tarjetas juntas (equiv. UYU):{" "}
                  {fmtUyu(
                    referenceExpenseByPay.debit + referenceExpenseByPay.credit,
                  )}{" "}
                  (déb. {fmtUyu(referenceExpenseByPay.debit)} · créd.{" "}
                  {fmtUyu(referenceExpenseByPay.credit)}) · efect./transf.{" "}
                  {fmtUyu(referenceExpenseByPay.otherPay)} · total gastos{" "}
                  {fmtUyu(referenceExpenseByPay.total)}
                </p>
              )}
            </div>
          )}

          {!referenceTotals &&
            usedCurrencies.includes("UYU") &&
            usedCurrencies.includes("USD") && (
              <p className="text-xs text-zinc-600">
                Tip: en{" "}
                <button
                  type="button"
                  className="text-zinc-400 underline hover:text-white"
                  onClick={() => setTab("data")}
                >
                  Datos
                </button>{" "}
                podés cargar un tipo de cambio referencia para ver un solo número
                que suma pesos y dólares (orientativo).
              </p>
            )}

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

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="mb-4 text-sm font-medium text-zinc-300">
              Últimos 6 meses — ingresos vs gastos
            </h2>
            <p className="mb-3 text-xs text-zinc-600">
              Todos los montos en{" "}
              <strong className="text-zinc-400">{reportCurrency}</strong>
              {settings.referenceUyuPerUsd != null &&
              settings.referenceUyuPerUsd > 0 &&
              (reportCurrency === "UYU" || reportCurrency === "USD")
                ? " (ingresos y gastos en UYU y USD combinados con el tipo de referencia en Datos)."
                : "."}{" "}
              La última barra es el mes que termina en{" "}
              {chartAnchor.toLocaleDateString("es-UY", {
                month: "long",
                year: "numeric",
              })}{" "}
              (mismo criterio que el período si elegiste un mes completo).
            </p>
            {barChartScaleNote && (
              <p className="mb-3 rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/90">
                Este mes los totales son mucho menores que en meses anteriores: en
                el gráfico la última barra puede verse casi invisible frente a la
                escala. No es un error de cálculo: solo cambió el volumen vs meses
                pasados.
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

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
            <h2 className="mb-2 text-sm font-medium text-zinc-300">
              Gastos del período por medio de pago
            </h2>
            <p className="mb-4 text-xs text-zinc-600">
              Misma moneda del resumen. Tarjetas = débito + crédito juntos; abajo el
              desglose. La suma de las tres filas inferiores coincide con el total de
              gastos ({fmt(expense)}).
            </p>
            <div className="mb-4 rounded-lg border border-zinc-700 bg-zinc-950/50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Con tarjeta (débito + crédito)
              </p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {fmt(cardSpendDebitPlusCredit)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Desglose: débito {fmt(dv.debit)} · crédito {fmt(dv.credit)}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-zinc-500">Solo tarjeta débito</p>
                <p className="text-xl font-semibold">{fmt(dv.debit)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Solo tarjeta crédito</p>
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
        <WishlistManager periodFrom={from} periodTo={to} />
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
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">{detail}</p>
      )}
      {hint && <p className="mt-2 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
