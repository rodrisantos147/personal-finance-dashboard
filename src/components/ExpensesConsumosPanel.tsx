"use client";

import {
  ChevronDown,
  ChevronRight,
  Folder,
  Home,
  Plane,
  ShoppingBag,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { CategoryExpenseDualRow } from "@/lib/finance";
import { expensesByCategoryDual } from "@/lib/finance";
import { formatMoneyWithSettings, txCurrency } from "@/lib/format";
import type { AppSettings, PaymentMethod, Transaction } from "@/lib/types";

const PIE_COLORS = [
  "#fafafa",
  "#d4d4d8",
  "#a1a1aa",
  "#71717a",
  "#52525b",
  "#3f3f46",
  "#27272a",
];

function categoryIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (/comida|gastro|restaur|super|aliment/i.test(n)) return UtensilsCrossed;
  if (/servicio|luz|agua|internet|tel[eé]fono|streaming|subscri/i.test(n))
    return Zap;
  if (/hogar|mueble|decor|lavar/i.test(n)) return Home;
  if (/viaje|hotel|vuelo|uber|taxi/i.test(n)) return Plane;
  if (/ropa|compra|shop|mercado/i.test(n)) return ShoppingBag;
  return Folder;
}

function paymentMethodLabel(pm: PaymentMethod): string {
  switch (pm) {
    case "debit":
      return "Débito";
    case "credit":
      return "Crédito";
    case "cash":
      return "Efectivo";
    case "transfer":
      return "Transferencia";
    default:
      return pm;
  }
}

function amountForColumn(
  t: Transaction,
  settings: AppSettings,
  col: "UYU" | "USD" | "other",
): number {
  const c = txCurrency(t, settings);
  if (col === "UYU") return c === "UYU" ? t.amount : 0;
  if (col === "USD") return c === "USD" ? t.amount : 0;
  return c !== "UYU" && c !== "USD" ? t.amount : 0;
}

export function ExpensesConsumosPanel({
  slice,
  settings,
}: {
  slice: Transaction[];
  settings: AppSettings;
}) {
  const rows = useMemo(
    () => expensesByCategoryDual(slice, settings),
    [slice, settings],
  );

  const fx = settings.referenceUyuPerUsd ?? 0;
  const hasFx = fx > 0;

  const totals = useMemo(() => {
    const o = {
      uyu: 0,
      usd: 0,
      other: 0,
      uyuDebit: 0,
      uyuCredit: 0,
      uyuOtherPay: 0,
      usdDebit: 0,
      usdCredit: 0,
      usdOtherPay: 0,
      otherDebit: 0,
      otherCredit: 0,
      otherOtherPay: 0,
    };
    for (const r of rows) {
      o.uyu += r.uyu;
      o.usd += r.usd;
      o.other += r.other;
      o.uyuDebit += r.uyuDebit;
      o.uyuCredit += r.uyuCredit;
      o.uyuOtherPay += r.uyuOtherPay;
      o.usdDebit += r.usdDebit;
      o.usdCredit += r.usdCredit;
      o.usdOtherPay += r.usdOtherPay;
      o.otherDebit += r.otherDebit;
      o.otherCredit += r.otherCredit;
      o.otherOtherPay += r.otherOtherPay;
    }
    return o;
  }, [rows]);

  const totalCombinedForPct = useMemo(() => {
    if (!hasFx) return 0;
    return rows.reduce((s, r) => s + r.uyu + r.usd * fx, 0);
  }, [rows, hasFx, fx]);

  const pieData = useMemo(() => {
    const data: { name: string; value: number }[] = [];
    for (const r of rows) {
      const v = hasFx ? r.uyu + r.usd * fx : r.uyu;
      if (v <= 0) continue;
      data.push({ name: r.category, value: v });
    }
    if (hasFx && totals.other > 0) {
      data.push({
        name: "Otras monedas (ARS/EUR…)",
        value: totals.other,
      });
    }
    return data.sort((a, b) => b.value - a.value);
  }, [rows, hasFx, fx, totals.other]);

  const [open, setOpen] = useState<Record<string, boolean>>({});

  const fmtUyu = (n: number) => formatMoneyWithSettings(n, settings, "UYU");
  const fmtUsd = (n: number) => formatMoneyWithSettings(n, settings, "USD");
  const fmtPlain = (n: number) =>
    n.toLocaleString(settings.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const showOtherCol = totals.other > 0;
  const mainColSpan = showOtherCol ? 14 : 10;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-sm text-zinc-500">
        No hay gastos en este período.
      </div>
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_min(360px,100%)]">
      <div className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/40">
        <div className="border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-medium text-zinc-200">Consumos</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Total por categoría y moneda; debajo, desglose por{" "}
            <strong className="text-zinc-400">débito</strong>,{" "}
            <strong className="text-zinc-400">crédito</strong> y{" "}
            <strong className="text-zinc-400">efectivo/transferencia</strong>.
            La suma de las tres columnas coincide con el total de la moneda.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-950/60 text-xs uppercase text-zinc-500">
              <tr>
                <th
                  rowSpan={2}
                  className="align-bottom px-3 py-2 font-medium text-zinc-400"
                >
                  Categoría
                </th>
                <th
                  colSpan={4}
                  className="border-l border-zinc-800 px-3 py-2 text-center font-medium text-zinc-300"
                >
                  Pesos (UYU)
                </th>
                <th
                  colSpan={4}
                  className="border-l border-zinc-800 px-3 py-2 text-center font-medium text-zinc-300"
                >
                  Dólares (USD)
                </th>
                {showOtherCol && (
                  <th
                    colSpan={4}
                    className="border-l border-zinc-800 px-3 py-2 text-center font-medium text-amber-200/80"
                  >
                    Otras monedas
                  </th>
                )}
                <th
                  rowSpan={2}
                  className="border-l border-zinc-800 px-3 py-2 text-right align-bottom"
                >
                  %
                </th>
              </tr>
              <tr className="text-[10px] normal-case tracking-normal text-zinc-600">
                <th className="border-l border-zinc-800 px-2 py-1.5 text-right font-medium">
                  Total
                </th>
                <th className="px-2 py-1.5 text-right font-medium" title="Tarjeta débito">
                  Déb.
                </th>
                <th className="px-2 py-1.5 text-right font-medium" title="Tarjeta crédito">
                  Créd.
                </th>
                <th className="px-2 py-1.5 text-right font-medium" title="Efectivo y transferencia">
                  Eft./transf.
                </th>
                <th className="border-l border-zinc-800 px-2 py-1.5 text-right font-medium">
                  Total
                </th>
                <th className="px-2 py-1.5 text-right font-medium" title="Tarjeta débito">
                  Déb.
                </th>
                <th className="px-2 py-1.5 text-right font-medium" title="Tarjeta crédito">
                  Créd.
                </th>
                <th className="px-2 py-1.5 text-right font-medium" title="Efectivo y transferencia">
                  Eft./transf.
                </th>
                {showOtherCol && (
                  <>
                    <th className="border-l border-zinc-800 px-2 py-1.5 text-right font-medium">
                      Total
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium">Déb.</th>
                    <th className="px-2 py-1.5 text-right font-medium">Créd.</th>
                    <th className="px-2 py-1.5 text-right font-medium">
                      Eft./transf.
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {rows.map((row) => {
                const Icon = categoryIcon(row.category);
                const isOpen = open[row.category] ?? false;
                const baseUyuEquiv = row.uyu + row.usd * fx;
                const pct =
                  hasFx && totalCombinedForPct > 0
                    ? baseUyuEquiv > 0
                      ? (baseUyuEquiv / totalCombinedForPct) * 100
                      : row.other > 0
                        ? null
                        : 0
                    : null;

                return (
                  <CategoryConsumoRow
                    key={row.category}
                    row={row}
                    Icon={Icon}
                    isOpen={isOpen}
                    onToggle={() =>
                      setOpen((o) => ({
                        ...o,
                        [row.category]: !isOpen,
                      }))
                    }
                    fmtUyu={fmtUyu}
                    fmtUsd={fmtUsd}
                    fmtPlain={fmtPlain}
                    settings={settings}
                    showOtherCol={showOtherCol}
                    pct={pct}
                    mainColSpan={mainColSpan}
                  />
                );
              })}
            </tbody>
            <tfoot className="border-t border-zinc-700 bg-zinc-950/40 text-sm">
              <tr>
                <td className="px-3 py-3 font-medium text-zinc-300">Total</td>
                <td className="border-l border-zinc-800 px-2 py-3 text-right font-semibold tabular-nums text-zinc-100">
                  {fmtUyu(totals.uyu)}
                </td>
                <td className="px-2 py-3 text-right tabular-nums text-zinc-300">
                  {fmtUyu(totals.uyuDebit)}
                </td>
                <td className="px-2 py-3 text-right tabular-nums text-zinc-300">
                  {fmtUyu(totals.uyuCredit)}
                </td>
                <td className="px-2 py-3 text-right tabular-nums text-zinc-400">
                  {fmtUyu(totals.uyuOtherPay)}
                </td>
                <td className="border-l border-zinc-800 px-2 py-3 text-right font-semibold tabular-nums text-zinc-100">
                  {fmtUsd(totals.usd)}
                </td>
                <td className="px-2 py-3 text-right tabular-nums text-zinc-300">
                  {fmtUsd(totals.usdDebit)}
                </td>
                <td className="px-2 py-3 text-right tabular-nums text-zinc-300">
                  {fmtUsd(totals.usdCredit)}
                </td>
                <td className="px-2 py-3 text-right tabular-nums text-zinc-400">
                  {fmtUsd(totals.usdOtherPay)}
                </td>
                {showOtherCol && (
                  <>
                    <td className="border-l border-zinc-800 px-2 py-3 text-right font-semibold tabular-nums text-amber-200/90">
                      {fmtPlain(totals.other)}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums text-amber-200/70">
                      {fmtPlain(totals.otherDebit)}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums text-amber-200/70">
                      {fmtPlain(totals.otherCredit)}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums text-amber-200/50">
                      {fmtPlain(totals.otherOtherPay)}
                    </td>
                  </>
                )}
                <td className="border-l border-zinc-800 px-3 py-3 text-right text-zinc-600">
                  {hasFx && totalCombinedForPct > 0 ? "100%" : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="flex min-w-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-medium text-zinc-300">Composición</h2>
        {pieData.length === 0 ? (
          <p className="mt-4 flex-1 text-xs text-zinc-600">
            No hay montos en pesos para armar el gráfico.{" "}
            {hasFx
              ? "Cargá movimientos o revisá el período."
              : "Configurá el tipo de cambio referencia en Datos para incluir dólares en el gráfico, o registrá gastos en pesos."}
          </p>
        ) : (
          <>
            <div className="mt-2 h-[280px] min-w-0 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={88}
                    paddingAngle={2}
                    label={false}
                  >
                    {pieData.map((_, i) => (
                      <Cell
                        key={pieData[i].name}
                        fill={PIE_COLORS[i % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) =>
                      fmtUyu(typeof v === "number" ? v : Number(v))
                    }
                    contentStyle={{
                      background: "#18181b",
                      border: "1px solid #27272a",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
              {hasFx
                ? "Cada segmento usa pesos + dólares convertidos con tu tipo de cambio referencia. “Otras monedas” no se convierten."
                : "Solo gastos en pesos (UYU). Para mezclar con USD en el gráfico, definí el tipo de cambio en Datos."}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function CategoryConsumoRow({
  row,
  Icon,
  isOpen,
  onToggle,
  fmtUyu,
  fmtUsd,
  fmtPlain,
  settings,
  showOtherCol,
  pct,
  mainColSpan,
}: {
  row: CategoryExpenseDualRow;
  Icon: LucideIcon;
  isOpen: boolean;
  onToggle: () => void;
  fmtUyu: (n: number) => string;
  fmtUsd: (n: number) => string;
  fmtPlain: (n: number) => string;
  settings: AppSettings;
  showOtherCol: boolean;
  pct: number | null;
  mainColSpan: number;
}) {
  return (
    <>
      <tr className="hover:bg-zinc-900/50">
        <td className="px-3 py-2.5">
          <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center gap-2 text-left text-zinc-200"
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
            )}
            <Icon className="h-4 w-4 shrink-0 text-zinc-500" />
            <span className="font-medium">{row.category}</span>
          </button>
        </td>
        <td className="border-l border-zinc-800/80 px-2 py-2.5 text-right tabular-nums text-zinc-100">
          {fmtUyu(row.uyu)}
        </td>
        <td className="px-2 py-2.5 text-right tabular-nums text-zinc-400">
          {fmtUyu(row.uyuDebit)}
        </td>
        <td className="px-2 py-2.5 text-right tabular-nums text-zinc-400">
          {fmtUyu(row.uyuCredit)}
        </td>
        <td className="px-2 py-2.5 text-right tabular-nums text-zinc-500">
          {fmtUyu(row.uyuOtherPay)}
        </td>
        <td className="border-l border-zinc-800/80 px-2 py-2.5 text-right tabular-nums text-zinc-100">
          {fmtUsd(row.usd)}
        </td>
        <td className="px-2 py-2.5 text-right tabular-nums text-zinc-400">
          {fmtUsd(row.usdDebit)}
        </td>
        <td className="px-2 py-2.5 text-right tabular-nums text-zinc-400">
          {fmtUsd(row.usdCredit)}
        </td>
        <td className="px-2 py-2.5 text-right tabular-nums text-zinc-500">
          {fmtUsd(row.usdOtherPay)}
        </td>
        {showOtherCol && (
          <>
            <td className="border-l border-zinc-800/80 px-2 py-2.5 text-right tabular-nums text-amber-200/90">
              {fmtPlain(row.other)}
            </td>
            <td className="px-2 py-2.5 text-right tabular-nums text-amber-200/60">
              {fmtPlain(row.otherDebit)}
            </td>
            <td className="px-2 py-2.5 text-right tabular-nums text-amber-200/60">
              {fmtPlain(row.otherCredit)}
            </td>
            <td className="px-2 py-2.5 text-right tabular-nums text-amber-200/40">
              {fmtPlain(row.otherOtherPay)}
            </td>
          </>
        )}
        <td className="border-l border-zinc-800/80 px-3 py-2.5 text-right tabular-nums text-zinc-500">
          {pct != null ? `${pct.toFixed(1)}%` : "—"}
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-zinc-950/50">
          <td colSpan={mainColSpan} className="px-3 pb-4 pt-0">
            <div className="ml-7 overflow-hidden rounded-lg border border-zinc-800/80">
              <table className="w-full text-xs">
                <thead className="bg-zinc-900/80 text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Fecha</th>
                    <th className="px-3 py-2 text-left font-medium">Detalle</th>
                    <th className="px-3 py-2 text-left font-medium">Medio</th>
                    <th className="px-3 py-2 text-right font-medium">Pesos</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Dólares
                    </th>
                    {showOtherCol && (
                      <th className="px-3 py-2 text-right font-medium text-zinc-600">
                        Otras
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {row.transactions.map((t) => (
                    <tr key={t.id}>
                      <td className="px-3 py-2 text-zinc-500">
                        {new Date(t.date).toLocaleDateString("es-UY")}
                      </td>
                      <td className="max-w-[180px] truncate px-3 py-2 text-zinc-300">
                        {t.description || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-zinc-500">
                        {paymentMethodLabel(t.paymentMethod)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-300">
                        {fmtUyu(amountForColumn(t, settings, "UYU"))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-300">
                        {fmtUsd(amountForColumn(t, settings, "USD"))}
                      </td>
                      {showOtherCol && (
                        <td className="px-3 py-2 text-right tabular-nums text-amber-200/70">
                          {amountForColumn(t, settings, "other") > 0
                            ? formatMoneyWithSettings(
                                amountForColumn(t, settings, "other"),
                                settings,
                                txCurrency(t, settings),
                              )
                            : fmtPlain(0)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-zinc-800 bg-zinc-900/40">
                  <tr>
                    <td
                      colSpan={3}
                      className="px-3 py-2 font-medium text-zinc-400"
                    >
                      Total {row.category}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {fmtUyu(row.uyu)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {fmtUsd(row.usd)}
                    </td>
                    {showOtherCol && (
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-amber-200/80">
                        {fmtPlain(row.other)}
                      </td>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
