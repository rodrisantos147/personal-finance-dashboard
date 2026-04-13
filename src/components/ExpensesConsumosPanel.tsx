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

/** Equivalente en pesos para un movimiento (USD × TC; otras monedas al nominal). */
function txPesoEquiv(
  t: Transaction,
  settings: AppSettings,
  fx: number,
  hasFx: boolean,
): number {
  const c = txCurrency(t, settings);
  if (c === "UYU") return t.amount;
  if (c === "USD") return hasFx ? t.amount * fx : 0;
  return t.amount;
}

function rowPesoEquiv(
  row: CategoryExpenseDualRow,
  fx: number,
  hasFx: boolean,
) {
  if (hasFx) {
    return {
      total: row.uyu + row.usd * fx + row.other,
      tarjetas:
        row.uyuDebit +
        row.uyuCredit +
        (row.usdDebit + row.usdCredit) * fx +
        row.otherDebit +
        row.otherCredit,
      eft:
        row.uyuOtherPay +
        row.usdOtherPay * fx +
        row.otherOtherPay,
    };
  }
  return {
    total: row.uyu,
    tarjetas: row.uyuDebit + row.uyuCredit,
    eft: row.uyuOtherPay,
  };
}

function TarjetasCell({
  debit,
  credit,
  fmt,
}: {
  debit: number;
  credit: number;
  fmt: (n: number) => string;
}) {
  const sum = debit + credit;
  return (
    <td className="align-top px-2 py-2.5 text-right tabular-nums">
      <div className="text-zinc-200">{fmt(sum)}</div>
      <div className="text-[10px] leading-tight text-zinc-600">
        D {fmt(debit)} · C {fmt(credit)}
      </div>
    </td>
  );
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

  const footEquiv = useMemo(
    () => rowPesoEquiv(
      {
        category: "",
        uyu: totals.uyu,
        usd: totals.usd,
        other: totals.other,
        uyuDebit: totals.uyuDebit,
        uyuCredit: totals.uyuCredit,
        uyuOtherPay: totals.uyuOtherPay,
        usdDebit: totals.usdDebit,
        usdCredit: totals.usdCredit,
        usdOtherPay: totals.usdOtherPay,
        otherDebit: totals.otherDebit,
        otherCredit: totals.otherCredit,
        otherOtherPay: totals.otherOtherPay,
        transactions: [],
      },
      fx,
      hasFx,
    ),
    [totals, fx, hasFx],
  );

  const totalCombinedForPct = useMemo(() => {
    if (!hasFx) {
      return rows.reduce((s, r) => s + r.uyu, 0);
    }
    return rows.reduce((s, r) => s + r.uyu + r.usd * fx + r.other, 0);
  }, [rows, hasFx, fx]);

  const pieData = useMemo(() => {
    const data: { name: string; value: number }[] = [];
    for (const r of rows) {
      const v = hasFx ? r.uyu + r.usd * fx + r.other : r.uyu;
      if (v <= 0) continue;
      data.push({ name: r.category, value: v });
    }
    return data.sort((a, b) => b.value - a.value);
  }, [rows, hasFx, fx]);

  const [open, setOpen] = useState<Record<string, boolean>>({});

  const fmtUyu = (n: number) => formatMoneyWithSettings(n, settings, "UYU");

  const mainColSpan = 5;

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
            Todo en <strong className="text-zinc-400">pesos uruguayos</strong>.
            {hasFx
              ? " Los gastos en USD se convierten con el tipo de cambio de Datos."
              : " Solo se muestran montos nativos en pesos; cargá un tipo de cambio en Datos para sumar también los USD en esta tabla."}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-950/60 text-xs uppercase text-zinc-500">
              <tr>
                <th
                  rowSpan={2}
                  className="align-bottom px-3 py-2 font-medium text-zinc-400"
                >
                  Categoría
                </th>
                <th
                  colSpan={3}
                  className="border-l border-zinc-800 px-3 py-2 text-center font-medium text-zinc-300"
                >
                  Pesos uruguayos (equivalente)
                </th>
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
                <th
                  className="px-2 py-1.5 text-right font-medium"
                  title="Tarjeta débito + tarjeta crédito (desglose debajo)"
                >
                  Tarjetas
                </th>
                <th className="px-2 py-1.5 text-right font-medium" title="Efectivo y transferencia">
                  Eft./transf.
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80">
              {rows.map((row) => {
                const Icon = categoryIcon(row.category);
                const isOpen = open[row.category] ?? false;
                const equiv = rowPesoEquiv(row, fx, hasFx);
                const baseForPct = hasFx
                  ? row.uyu + row.usd * fx + row.other
                  : row.uyu;
                const pct =
                  totalCombinedForPct > 0 && baseForPct > 0
                    ? (baseForPct / totalCombinedForPct) * 100
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
                    settings={settings}
                    pct={pct}
                    mainColSpan={mainColSpan}
                    equiv={equiv}
                    hasFx={hasFx}
                    fx={fx}
                  />
                );
              })}
            </tbody>
            <tfoot className="border-t border-zinc-700 bg-zinc-950/40 text-sm">
              <tr>
                <td className="px-3 py-3 font-medium text-zinc-300">Total</td>
                <td className="border-l border-zinc-800 px-2 py-3 text-right font-semibold tabular-nums text-zinc-100">
                  {fmtUyu(footEquiv.total)}
                </td>
                <TarjetasCell
                  debit={
                    hasFx
                      ? totals.uyuDebit + totals.usdDebit * fx + totals.otherDebit
                      : totals.uyuDebit
                  }
                  credit={
                    hasFx
                      ? totals.uyuCredit +
                        totals.usdCredit * fx +
                        totals.otherCredit
                      : totals.uyuCredit
                  }
                  fmt={fmtUyu}
                />
                <td className="px-2 py-3 text-right tabular-nums text-zinc-400">
                  {fmtUyu(
                    hasFx
                      ? totals.uyuOtherPay +
                          totals.usdOtherPay * fx +
                          totals.otherOtherPay
                      : totals.uyuOtherPay,
                  )}
                </td>
                <td className="border-l border-zinc-800 px-3 py-3 text-right text-zinc-600">
                  {totalCombinedForPct > 0 ? "100%" : "—"}
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
              : "Configurá el tipo de cambio en Datos para incluir dólares en el gráfico, o registrá gastos en pesos."}
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
                ? "Cada segmento es el total de la categoría en pesos (UYU + USD × TC + otras monedas al nominal)."
                : "Solo gastos registrados en pesos. Definí el tipo de cambio en Datos para incluir USD en el gráfico."}
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
  settings,
  pct,
  mainColSpan,
  equiv,
  hasFx,
  fx,
}: {
  row: CategoryExpenseDualRow;
  Icon: LucideIcon;
  isOpen: boolean;
  onToggle: () => void;
  fmtUyu: (n: number) => string;
  settings: AppSettings;
  pct: number | null;
  mainColSpan: number;
  equiv: { total: number; tarjetas: number; eft: number };
  hasFx: boolean;
  fx: number;
}) {
  const debitEquiv = hasFx
    ? row.uyuDebit + row.usdDebit * fx + row.otherDebit
    : row.uyuDebit;
  const creditEquiv = hasFx
    ? row.uyuCredit + row.usdCredit * fx + row.otherCredit
    : row.uyuCredit;

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
          {fmtUyu(equiv.total)}
        </td>
        <TarjetasCell debit={debitEquiv} credit={creditEquiv} fmt={fmtUyu} />
        <td className="px-2 py-2.5 text-right tabular-nums text-zinc-500">
          {fmtUyu(equiv.eft)}
        </td>
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
                    <th className="px-3 py-2 text-right font-medium">
                      Importe (pesos)
                    </th>
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
                        {fmtUyu(txPesoEquiv(t, settings, fx, hasFx))}
                      </td>
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
                      {fmtUyu(equiv.total)}
                    </td>
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
