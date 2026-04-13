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
  TransactionType,
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

/** Ingresos que entran en KPI / resultado del período (excluye pagos TC, traspasos). */
export function countsAsPeriodIncome(t: Transaction): boolean {
  return t.type === "income" && !t.omitFromPeriodSummary;
}

/** Egresos que entran en KPI / resultado del período. */
export function countsAsPeriodExpense(t: Transaction): boolean {
  return t.type === "expense" && !t.omitFromPeriodSummary;
}

/**
 * Compras con tarjeta que quedaron como `income` (típico: extracto con monto
 * positivo o columna “crédito” mal leída). No toca reintegros ni pagos de tarjeta.
 */
export function shouldReclassifyIncomeAsCardExpense(t: {
  type: TransactionType;
  description: string;
}): boolean {
  if (t.type !== "income") return false;
  const u = t.description.trim().toUpperCase();
  if (
    /REINTEGRO|DEVOLUC|DEVOLUCI|CASHBACK|AJUSTE\s+A\s+FAVOR|ABONO\s+CRED|CREDITO\s+VARIOS/i.test(
      u,
    )
  ) {
    return false;
  }
  if (
    /RECIBO\s+DE\s+PAGO|PAGO\s+.*TARJ|LIQUIDACI[ÓO]N\s+TARJ|TARJETA\s*\*{2,}/i.test(
      t.description,
    )
  ) {
    return false;
  }
  const d = t.description.trim();
  if (
    /\bTRASPASO\s+DE\b/i.test(d) ||
    /^CRE\.?\s+CAMBIOS\b/i.test(d) ||
    /\b(?:DEPOSITO|DEPÓSITO|ACREDITACI|TRANSF(?:ERENCIA)?\s+RECIB)/i.test(u)
  ) {
    return false;
  }
  return (
    /DLO\*|DLO\s*\*|PEDIDOSYA|PEDIDOS\s*YA|RAPPI|UBER\s*\*?|STM\b|SINERGIA|TU\s+RACION|RACION\b|SPOTIFY|CLAUDE|UTE\b|SODIMAC|TIENDAMIA|BAMBOO|MERPAGO|MP\s*\*|NETFLIX|HBO|PRIME|APPLE\.COM|GOOGLE\s*\*|OPENAI|REPLIT|CURSOR|CLOUDFLARE|SUBSCRIPTION|\bTATA\b|\bBDB\b|\bZARA\b/i.test(
      u,
    ) || /\bCUOTA\s+\d+\s*\/\s*\d+/i.test(u)
  );
}

/** Ingresos que en extractos de TC son pagos desde cuenta, no sueldo ni cobros reales. */
export function inferOmitFromPeriodSummary(
  type: TransactionType,
  description: string,
): boolean {
  if (type !== "income") return false;
  const d = description.trim();
  return (
    /RECIBO\s+DE\s+PAGO|RECIBO\s+PAGO\s+TARJ|PAGO\s+(DE\s+)?TARJETA|PAGO\s+TC\b|PAGO\s+TOTAL\s+TARJ|LIQUIDACI[ÓO]N\s+TARJ|LIQ\.?\s*TARJ|TARJETA\s*\*{2,}|CREDITO\s+PAGO\s+TARJ|ABONO\s+PAGO\s+TARJ/i.test(
      d,
    ) || /PAGO\s+.*\d{4}\s*\*{2,}\d{2,4}/i.test(d)
  );
}

export function sumIncome(
  transactions: Transaction[],
  settings: AppSettings,
  currency: CurrencyCode,
) {
  return transactions
    .filter(
      (t) =>
        countsAsPeriodIncome(t) && txCurrency(t, settings) === currency,
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
        countsAsPeriodExpense(t) && txCurrency(t, settings) === currency,
    )
    .reduce((s, t) => s + t.amount, 0);
}

/** Ingresos en monedas distintas de UYU y USD (p. ej. EUR), al nominal. */
function sumIncomeNonUyuUsd(
  transactions: Transaction[],
  settings: AppSettings,
): number {
  let s = 0;
  for (const t of transactions) {
    if (!countsAsPeriodIncome(t)) continue;
    const c = txCurrency(t, settings);
    if (c !== "UYU" && c !== "USD") s += t.amount;
  }
  return s;
}

function sumExpenseNonUyuUsd(
  transactions: Transaction[],
  settings: AppSettings,
): number {
  let s = 0;
  for (const t of transactions) {
    if (!countsAsPeriodExpense(t)) continue;
    const c = txCurrency(t, settings);
    if (c !== "UYU" && c !== "USD") s += t.amount;
  }
  return s;
}

/**
 * Ingresos y gastos en la moneda del informe. Si hay `referenceUyuPerUsd` y la
 * moneda es UYU o USD, combina UYU + USD con conversión. EUR u otras se suman al
 * nominal en la unidad del informe (aproximado). Sin tipo válido, en UYU/USD
 * también se incluyen esas “otras” al nominal.
 */
export function sumIncomeExpenseForReport(
  transactions: Transaction[],
  settings: AppSettings,
  reportCurrency: CurrencyCode,
): { income: number; expense: number } {
  const fx = settings.referenceUyuPerUsd;
  const oi = sumIncomeNonUyuUsd(transactions, settings);
  const oe = sumExpenseNonUyuUsd(transactions, settings);

  if (
    fx != null &&
    Number.isFinite(fx) &&
    fx > 0 &&
    (reportCurrency === "UYU" || reportCurrency === "USD")
  ) {
    const iu = sumIncome(transactions, settings, "UYU");
    const eu = sumExpense(transactions, settings, "UYU");
    const id = sumIncome(transactions, settings, "USD");
    const ed = sumExpense(transactions, settings, "USD");
    if (reportCurrency === "UYU") {
      return { income: iu + id * fx + oi, expense: eu + ed * fx + oe };
    }
    return {
      income: iu / fx + id + oi,
      expense: eu / fx + ed + oe,
    };
  }

  if (reportCurrency === "UYU") {
    return {
      income: sumIncome(transactions, settings, "UYU") + oi,
      expense: sumExpense(transactions, settings, "UYU") + oe,
    };
  }
  if (reportCurrency === "USD") {
    return {
      income: sumIncome(transactions, settings, "USD") + oi,
      expense: sumExpense(transactions, settings, "USD") + oe,
    };
  }

  return {
    income: sumIncome(transactions, settings, reportCurrency),
    expense: sumExpense(transactions, settings, reportCurrency),
  };
}

/**
 * Cuánto aporta un movimiento al total de **ingresos** del informe (misma regla que
 * `sumIncomeExpenseForReport`). Sirve para auditar el KPI sin adivinar.
 */
export function transactionIncomeContributionInReport(
  t: Transaction,
  settings: AppSettings,
  reportCurrency: CurrencyCode,
): number {
  if (!countsAsPeriodIncome(t)) return 0;
  const cur = txCurrency(t, settings);
  const fx = settings.referenceUyuPerUsd;
  const hasFx =
    fx != null &&
    Number.isFinite(fx) &&
    fx > 0 &&
    (reportCurrency === "UYU" || reportCurrency === "USD");

  if (hasFx) {
    if (reportCurrency === "UYU") {
      if (cur === "UYU") return t.amount;
      if (cur === "USD") return t.amount * fx;
      return t.amount;
    }
    if (cur === "UYU") return t.amount / fx;
    if (cur === "USD") return t.amount;
    return t.amount;
  }

  if (reportCurrency === "UYU") {
    if (cur === "UYU") return t.amount;
    if (cur === "USD") return 0;
    return t.amount;
  }
  if (reportCurrency === "USD") {
    if (cur === "USD") return t.amount;
    if (cur === "UYU") return 0;
    return t.amount;
  }
  if (cur === "EUR") return t.amount;
  return 0;
}

/**
 * Ingresos, gastos y resultado del período expresados en UYU de referencia:
 * montos en UYU + USD × `uyuPerUsd` + otras monedas al nominal (ver
 * `sumIncomeExpenseForReport`). Devuelve `null` si no hay tipo de cambio válido.
 */
export function combinedPeriodTotalsReferenceUyu(
  transactions: Transaction[],
  settings: AppSettings,
  uyuPerUsd: number,
): { income: number; expense: number; net: number } | null {
  if (!Number.isFinite(uyuPerUsd) || uyuPerUsd <= 0) return null;
  const { income, expense } = sumIncomeExpenseForReport(
    transactions,
    { ...settings, referenceUyuPerUsd: uyuPerUsd },
    "UYU",
  );
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
    if (!countsAsPeriodExpense(t)) continue;
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
  /** EUR u otras monedas distintas de UYU/USD */
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
    if (!countsAsPeriodExpense(t)) continue;
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
    if (!countsAsPeriodExpense(t)) continue;
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
    if (!countsAsPeriodExpense(t)) continue;
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
    if (t.omitFromPeriodSummary) continue;
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
    if (!countsAsPeriodIncome(t) || !t.isPending) continue;
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
  const { income, expense } = sumIncomeExpenseForReport(slice, settings, currency);
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
    const { income, expense } = sumIncomeExpenseForReport(
      slice,
      settings,
      currency,
    );
    buckets.push({
      key,
      label: from.toLocaleDateString("es-UY", { month: "short", year: "2-digit" }),
      income,
      expense,
    });
  }
  return buckets;
}

export type CompareToPreviousPeriodOptions = {
  /**
   * Si el rango actual es un mes calendario completo (del 1 al último día),
   * compara contra el **mes anterior calendario** entero. Así “vs período anterior”
   * coincide con el mes previo (p. ej. febrero vs enero), no con una ventana de N
   * días mal alineada.
   */
  alignPreviousToCalendarMonth?: boolean;
};

function isFullCalendarMonthRange(from: Date, to: Date): boolean {
  return (
    from.getTime() === startOfMonth(from).getTime() &&
    to.getTime() === endOfMonth(from).getTime()
  );
}

export function compareToPreviousPeriod(
  transactions: Transaction[],
  from: Date,
  to: Date,
  settings: AppSettings,
  currency: CurrencyCode,
  options?: CompareToPreviousPeriodOptions,
) {
  let prevFrom: Date;
  let prevTo: Date;

  if (
    options?.alignPreviousToCalendarMonth &&
    isFullCalendarMonthRange(from, to)
  ) {
    const ref = subMonths(from, 1);
    prevFrom = startOfMonth(ref);
    prevTo = endOfMonth(ref);
  } else {
    const len = to.getTime() - from.getTime();
    prevTo = addDays(from, -1);
    prevFrom = addDays(prevTo, -Math.round(len / (1000 * 60 * 60 * 24)));
  }

  const cur = filterByDateRange(transactions, from, to);
  const prev = filterByDateRange(transactions, prevFrom, prevTo);
  const curTotals = sumIncomeExpenseForReport(cur, settings, currency);
  const prevTotals = sumIncomeExpenseForReport(prev, settings, currency);
  const curIncome = curTotals.income;
  const curExpense = curTotals.expense;
  const prevIncome = prevTotals.income;
  const prevExpense = prevTotals.expense;
  /** Variación en % con un decimal; tope ±500 para evitar +69000% cuando el mes anterior ~0. */
  const pct = (a: number, b: number) => {
    if (b === 0) return a === 0 ? 0 : 100;
    const raw = ((a - b) / b) * 100;
    if (!Number.isFinite(raw)) return 0;
    const rounded = Math.round(raw * 10) / 10;
    const cap = 500;
    if (rounded > cap) return cap;
    if (rounded < -cap) return -cap;
    return rounded;
  };
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
