import {
  addDays,
  addMonths,
  endOfDay,
  endOfMonth,
  isAfter,
  isBefore,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { resolveDefaultCurrency, txCurrency } from "./format";
import type {
  AppSettings,
  CreditCard,
  CurrencyCode,
  RecurringIncome,
  Transaction,
} from "./types";

export function filterByDateRange(
  items: Transaction[],
  from: Date,
  to: Date,
) {
  return items.filter((t) => {
    const d = new Date(t.date);
    return isWithinInterval(d, { start: startOfDay(from), end: endOfDay(to) });
  });
}

export function sumIncome(
  transactions: Transaction[],
  settings: AppSettings,
  currency: CurrencyCode,
) {
  return transactions
    .filter(
      (t) =>
        t.type === "income" && txCurrency(t, settings) === currency,
    )
    .reduce((s, t) => s + t.amount, 0);
}

export function sumExpense(
  transactions: Transaction[],
  settings: AppSettings,
  currency: CurrencyCode,
) {
  return transactions
    .filter(
      (t) =>
        t.type === "expense" && txCurrency(t, settings) === currency,
    )
    .reduce((s, t) => s + t.amount, 0);
}

/**
 * Ingresos, gastos y resultado del período expresados en UYU de referencia:
 * montos en UYU + montos en USD × `uyuPerUsd`.
 * No incluye otras monedas (ARS/EUR). Devuelve `null` si no hay tipo de cambio válido.
 */
export function combinedPeriodTotalsReferenceUyu(
  transactions: Transaction[],
  settings: AppSettings,
  uyuPerUsd: number,
): { income: number; expense: number; net: number } | null {
  if (!Number.isFinite(uyuPerUsd) || uyuPerUsd <= 0) return null;
  const iu = sumIncome(transactions, settings, "UYU");
  const eu = sumExpense(transactions, settings, "UYU");
  const id = sumIncome(transactions, settings, "USD");
  const ed = sumExpense(transactions, settings, "USD");
  const income = iu + id * uyuPerUsd;
  const expense = eu + ed * uyuPerUsd;
  return { income, expense, net: income - expense };
}

/**
 * Gastos del período en “pesos equivalentes” por medio de pago (USD × `uyuPerUsd`).
 * `other` monedas se suman al nominal sin convertir.
 */
export function combinedExpenseByPaymentReferenceUyu(
  transactions: Transaction[],
  settings: AppSettings,
  uyuPerUsd: number,
): { debit: number; credit: number; otherPay: number; total: number } | null {
  if (!Number.isFinite(uyuPerUsd) || uyuPerUsd <= 0) return null;
  let debit = 0;
  let credit = 0;
  let otherPay = 0;
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const cur = txCurrency(t, settings);
    const equiv =
      cur === "UYU"
        ? t.amount
        : cur === "USD"
          ? t.amount * uyuPerUsd
          : t.amount;
    if (t.paymentMethod === "credit") credit += equiv;
    else if (t.paymentMethod === "debit") debit += equiv;
    else otherPay += equiv;
  }
  return {
    debit,
    credit,
    otherPay,
    total: debit + credit + otherPay,
  };
}

export type CategoryExpenseDualRow = {
  category: string;
  uyu: number;
  usd: number;
  /** ARS, EUR u otras monedas distintas de UYU/USD */
  other: number;
  /** Tarjeta de débito */
  uyuDebit: number;
  /** Tarjeta de crédito */
  uyuCredit: number;
  /** Efectivo + transferencia */
  uyuOtherPay: number;
  usdDebit: number;
  usdCredit: number;
  usdOtherPay: number;
  otherDebit: number;
  otherCredit: number;
  otherOtherPay: number;
  transactions: Transaction[];
};

/** Gastos del período agrupados por categoría con totales en UYU y USD por separado. */
export function expensesByCategoryDual(
  transactions: Transaction[],
  settings: AppSettings,
): CategoryExpenseDualRow[] {
  const map = new Map<string, CategoryExpenseDualRow>();
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const k = t.category || "Sin categoría";
    if (!map.has(k)) {
      map.set(k, {
        category: k,
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
        transactions: [],
      });
    }
    const row = map.get(k)!;
    row.transactions.push(t);
    const cur = txCurrency(t, settings);
    const pm = t.paymentMethod;
    if (cur === "UYU") {
      row.uyu += t.amount;
      if (pm === "credit") row.uyuCredit += t.amount;
      else if (pm === "debit") row.uyuDebit += t.amount;
      else row.uyuOtherPay += t.amount;
    } else if (cur === "USD") {
      row.usd += t.amount;
      if (pm === "credit") row.usdCredit += t.amount;
      else if (pm === "debit") row.usdDebit += t.amount;
      else row.usdOtherPay += t.amount;
    } else {
      row.other += t.amount;
      if (pm === "credit") row.otherCredit += t.amount;
      else if (pm === "debit") row.otherDebit += t.amount;
      else row.otherOtherPay += t.amount;
    }
  }
  const rows = Array.from(map.values());
  const fx = settings.referenceUyuPerUsd ?? 0;
  rows.sort((a, b) => {
    if (fx > 0) {
      return (
        b.uyu +
        b.usd * fx -
        (a.uyu + a.usd * fx)
      );
    }
    if (b.uyu !== a.uyu) return b.uyu - a.uyu;
    return b.usd - a.usd;
  });
  for (const row of rows) {
    row.transactions.sort((a, b) => b.date.localeCompare(a.date));
  }
  return rows;
}

export function expensesByCategory(
  transactions: Transaction[],
  settings: AppSettings,
  currency: CurrencyCode,
) {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    if (txCurrency(t, settings) !== currency) continue;
    const k = t.category || "Sin categoría";
    map.set(k, (map.get(k) ?? 0) + t.amount);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function debitVsCredit(
  transactions: Transaction[],
  settings: AppSettings,
  currency: CurrencyCode,
) {
  let debit = 0;
  let credit = 0;
  let other = 0;
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    if (txCurrency(t, settings) !== currency) continue;
    if (t.paymentMethod === "debit") debit += t.amount;
    else if (t.paymentMethod === "credit") credit += t.amount;
    else other += t.amount;
  }
  return { debit, credit, other };
}

export function pendingTotals(
  transactions: Transaction[],
  settings: AppSettings,
  currency: CurrencyCode,
) {
  let pendingIncome = 0;
  let pendingExpense = 0;
  for (const t of transactions) {
    if (!t.isPending) continue;
    if (txCurrency(t, settings) !== currency) continue;
    if (t.type === "income") pendingIncome += t.amount;
    else pendingExpense += t.amount;
  }
  return { pendingIncome, pendingExpense };
}

function dateFromEntryClosing(
  year: number,
  month1: number,
  closingDay: number,
): Date {
  const dim = daysInMonth(year, month1 - 1);
  return new Date(year, month1 - 1, Math.min(closingDay, dim));
}

function dateFromEntryDue(
  year: number,
  month1: number,
  dueDay: number,
): Date {
  const dim = daysInMonth(year, month1 - 1);
  return new Date(year, month1 - 1, Math.min(dueDay, dim));
}

/** Próxima fecha de cierre >= from */
export function nextClosingDate(card: CreditCard, from: Date): Date {
  const start = startOfDay(from);
  if (card.annualSchedule?.length) {
    let best: Date | null = null;
    for (const e of card.annualSchedule) {
      const d = dateFromEntryClosing(e.year, e.month, e.closingDay);
      if (!isBefore(d, start)) {
        if (!best || isBefore(d, best)) best = d;
      }
    }
    if (best) return best;
  }
  const y = from.getFullYear();
  const m = from.getMonth();
  const day = Math.min(card.closingDay, daysInMonth(y, m));
  let candidate = new Date(y, m, day);
  if (isBefore(candidate, start)) {
    const nm = addMonths(candidate, 1);
    const d2 = Math.min(
      card.closingDay,
      daysInMonth(nm.getFullYear(), nm.getMonth()),
    );
    candidate = new Date(nm.getFullYear(), nm.getMonth(), d2);
  }
  return candidate;
}

/** Próximo vencimiento >= from */
export function nextDueDate(card: CreditCard, from: Date): Date {
  const start = startOfDay(from);
  if (card.annualSchedule?.length) {
    let best: Date | null = null;
    for (const e of card.annualSchedule) {
      const d = dateFromEntryDue(e.year, e.month, e.dueDay);
      if (!isBefore(d, start)) {
        if (!best || isBefore(d, best)) best = d;
      }
    }
    if (best) return best;
  }
  const y = from.getFullYear();
  const m = from.getMonth();
  const day = Math.min(card.dueDay, daysInMonth(y, m));
  let candidate = new Date(y, m, day);
  if (isBefore(candidate, start)) {
    const nm = addMonths(candidate, 1);
    const d2 = Math.min(
      card.dueDay,
      daysInMonth(nm.getFullYear(), nm.getMonth()),
    );
    candidate = new Date(nm.getFullYear(), nm.getMonth(), d2);
  }
  return candidate;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Saldo “usado” en pesos equivalentes para una tarjeta: egresos con crédito menos
 * ingresos/reintegros con la misma tarjeta. USD se convierte con `referenceUyuPerUsd`
 * si está configurado; si no, solo cuenta movimientos en UYU.
 */
export function creditCardNetUsedUyuEquiv(
  transactions: Transaction[],
  cardId: string,
  settings: AppSettings,
): number {
  const fx = settings.referenceUyuPerUsd ?? 0;
  let net = 0;
  for (const t of transactions) {
    if (t.cardId !== cardId || t.paymentMethod !== "credit") continue;
    const cur = txCurrency(t, settings);
    let uyuEq = 0;
    if (cur === "UYU") uyuEq = t.amount;
    else if (cur === "USD" && fx > 0) uyuEq = t.amount * fx;
    else continue;
    if (t.type === "expense") net += uyuEq;
    else if (t.type === "income") net -= uyuEq;
  }
  return Math.max(0, net);
}

export function daysUntil(date: Date, from: Date = new Date()) {
  const a = startOfDay(from).getTime();
  const b = startOfDay(date).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/** Ingresos futuros estimados: recurrentes del mes actual desde hoy + movimientos income pendientes con fecha futura */
export function estimateFutureIncome(
  transactions: Transaction[],
  recurring: RecurringIncome[],
  horizonEnd: Date,
  settings: AppSettings,
  currency: CurrencyCode,
) {
  const today = startOfDay(new Date());
  let fromRecurring = 0;
  for (const r of recurring) {
    if (!r.active) continue;
    const rc = r.currency ?? resolveDefaultCurrency(settings);
    if (rc !== currency) continue;
    let cursor = startOfMonth(today);
    const end = endOfMonth(horizonEnd);
    while (!isAfter(cursor, end)) {
      const y = cursor.getFullYear();
      const mo = cursor.getMonth();
      const d = Math.min(r.dayOfMonth, daysInMonth(y, mo));
      const occ = new Date(y, mo, d);
      if (!isBefore(occ, today) && !isAfter(occ, horizonEnd)) {
        fromRecurring += r.amount;
      }
      cursor = addMonths(cursor, 1);
    }
  }
  let fromPending = 0;
  for (const t of transactions) {
    if (t.type !== "income" || !t.isPending) continue;
    if (txCurrency(t, settings) !== currency) continue;
    const d = new Date(t.date);
    if (isAfter(d, today) && !isAfter(d, horizonEnd)) {
      fromPending += t.amount;
    }
  }
  return { fromRecurring, fromPending, total: fromRecurring + fromPending };
}

export function currenciesInUse(
  transactions: Transaction[],
  settings: AppSettings,
): CurrencyCode[] {
  const set = new Set<CurrencyCode>();
  for (const t of transactions) {
    set.add(txCurrency(t, settings));
  }
  const list = Array.from(set);
  list.sort();
  return list.length ? list : [resolveDefaultCurrency(settings)];
}

/** Superávit proyectado (período + pendientes + futuros) en una moneda. */
export function projectedSurplusForPeriod(
  transactions: Transaction[],
  recurring: RecurringIncome[],
  settings: AppSettings,
  currency: CurrencyCode,
  from: Date,
  to: Date,
) {
  const slice = filterByDateRange(transactions, from, to);
  const horizon = endOfMonth(new Date());
  const income = sumIncome(slice, settings, currency);
  const expense = sumExpense(slice, settings, currency);
  const p = pendingTotals(transactions, settings, currency);
  const f = estimateFutureIncome(
    transactions,
    recurring,
    horizon,
    settings,
    currency,
  );
  return (
    income -
    expense +
    p.pendingIncome -
    p.pendingExpense +
    f.total
  );
}

/**
 * @param anchorEnd — mes incluido como última barra (normalmente el mes del período
 * seleccionado en el dashboard). Si no se pasa, usa el mes calendario actual.
 */
export function monthlyBuckets(
  transactions: Transaction[],
  monthsBack: number,
  settings: AppSettings,
  currency: CurrencyCode,
  anchorEnd?: Date,
) {
  const endRef = anchorEnd
    ? endOfMonth(anchorEnd)
    : endOfMonth(new Date());
  const endMonthStart = startOfMonth(endRef);
  const buckets: {
    key: string;
    label: string;
    income: number;
    expense: number;
  }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const ref = subMonths(endMonthStart, i);
    const from = startOfMonth(ref);
    const to = endOfMonth(ref);
    const slice = filterByDateRange(transactions, from, to);
    const key = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      key,
      label: from.toLocaleDateString("es-UY", { month: "short", year: "2-digit" }),
      income: sumIncome(slice, settings, currency),
      expense: sumExpense(slice, settings, currency),
    });
  }
  return buckets;
}

export function compareToPreviousPeriod(
  transactions: Transaction[],
  from: Date,
  to: Date,
  settings: AppSettings,
  currency: CurrencyCode,
) {
  const len = to.getTime() - from.getTime();
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -Math.round(len / (1000 * 60 * 60 * 24)));
  const cur = filterByDateRange(transactions, from, to);
  const prev = filterByDateRange(transactions, prevFrom, prevTo);
  const curIncome = sumIncome(cur, settings, currency);
  const curExpense = sumExpense(cur, settings, currency);
  const prevIncome = sumIncome(prev, settings, currency);
  const prevExpense = sumExpense(prev, settings, currency);
  /** Variación en % con un decimal (evita −100% cuando en realidad hubo algo de ingreso/gasto). */
  const pct = (a: number, b: number) =>
    b === 0 ? (a === 0 ? 0 : 100) : Math.round(((a - b) / b) * 1000) / 10;
  return {
    prevFrom,
    prevTo,
    deltaIncomePct: pct(curIncome, prevIncome),
    deltaExpensePct: pct(curExpense, prevExpense),
    curIncome,
    curExpense,
    prevIncome,
    prevExpense,
  };
}
