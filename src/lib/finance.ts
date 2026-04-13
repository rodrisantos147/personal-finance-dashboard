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
import type { CreditCard, RecurringIncome, Transaction } from "./types";

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

export function sumIncome(transactions: Transaction[]) {
  return transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
}

export function sumExpense(transactions: Transaction[]) {
  return transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
}

export function expensesByCategory(transactions: Transaction[]) {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const k = t.category || "Sin categoría";
    map.set(k, (map.get(k) ?? 0) + t.amount);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function debitVsCredit(transactions: Transaction[]) {
  let debit = 0;
  let credit = 0;
  let other = 0;
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    if (t.paymentMethod === "debit") debit += t.amount;
    else if (t.paymentMethod === "credit") credit += t.amount;
    else other += t.amount;
  }
  return { debit, credit, other };
}

export function pendingTotals(transactions: Transaction[]) {
  let pendingIncome = 0;
  let pendingExpense = 0;
  for (const t of transactions) {
    if (!t.isPending) continue;
    if (t.type === "income") pendingIncome += t.amount;
    else pendingExpense += t.amount;
  }
  return { pendingIncome, pendingExpense };
}

/** Próxima fecha de cierre >= from */
export function nextClosingDate(card: CreditCard, from: Date): Date {
  const y = from.getFullYear();
  const m = from.getMonth();
  const day = Math.min(card.closingDay, daysInMonth(y, m));
  let candidate = new Date(y, m, day);
  if (isBefore(candidate, startOfDay(from))) {
    const nm = addMonths(candidate, 1);
    const d2 = Math.min(card.closingDay, daysInMonth(nm.getFullYear(), nm.getMonth()));
    candidate = new Date(nm.getFullYear(), nm.getMonth(), d2);
  }
  return candidate;
}

/** Próximo vencimiento >= from */
export function nextDueDate(card: CreditCard, from: Date): Date {
  const y = from.getFullYear();
  const m = from.getMonth();
  const day = Math.min(card.dueDay, daysInMonth(y, m));
  let candidate = new Date(y, m, day);
  if (isBefore(candidate, startOfDay(from))) {
    const nm = addMonths(candidate, 1);
    const d2 = Math.min(card.dueDay, daysInMonth(nm.getFullYear(), nm.getMonth()));
    candidate = new Date(nm.getFullYear(), nm.getMonth(), d2);
  }
  return candidate;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
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
) {
  const today = startOfDay(new Date());
  let fromRecurring = 0;
  for (const r of recurring) {
    if (!r.active) continue;
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
    const d = new Date(t.date);
    if (isAfter(d, today) && !isAfter(d, horizonEnd)) {
      fromPending += t.amount;
    }
  }
  return { fromRecurring, fromPending, total: fromRecurring + fromPending };
}

export function monthlyBuckets(
  transactions: Transaction[],
  monthsBack: number,
) {
  const now = new Date();
  const buckets: {
    key: string;
    label: string;
    income: number;
    expense: number;
  }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const ref = subMonths(now, i);
    const from = startOfMonth(ref);
    const to = endOfMonth(ref);
    const slice = filterByDateRange(transactions, from, to);
    const key = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      key,
      label: from.toLocaleDateString("es-AR", { month: "short", year: "2-digit" }),
      income: sumIncome(slice),
      expense: sumExpense(slice),
    });
  }
  return buckets;
}

export function compareToPreviousPeriod(
  transactions: Transaction[],
  from: Date,
  to: Date,
) {
  const len = to.getTime() - from.getTime();
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -Math.round(len / (1000 * 60 * 60 * 24)));
  const cur = filterByDateRange(transactions, from, to);
  const prev = filterByDateRange(transactions, prevFrom, prevTo);
  const curIncome = sumIncome(cur);
  const curExpense = sumExpense(cur);
  const prevIncome = sumIncome(prev);
  const prevExpense = sumExpense(prev);
  const pct = (a: number, b: number) =>
    b === 0 ? (a === 0 ? 0 : 100) : Math.round(((a - b) / b) * 100);
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
