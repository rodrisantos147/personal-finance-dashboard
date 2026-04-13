import type { CreditCardMonthEntry } from "./types";

/**
 * Calendario 2026 según tu tabla (cierre y vencimiento por mes).
 * Podés duplicar el patrón en Datos / tarjeta para otros años.
 */
export const ITAU_STYLE_2026_SCHEDULE: CreditCardMonthEntry[] = [
  { year: 2026, month: 1, closingDay: 5, dueDay: 19 },
  { year: 2026, month: 2, closingDay: 3, dueDay: 18 },
  { year: 2026, month: 3, closingDay: 3, dueDay: 16 },
  { year: 2026, month: 4, closingDay: 6, dueDay: 20 },
  { year: 2026, month: 5, closingDay: 4, dueDay: 19 },
  { year: 2026, month: 6, closingDay: 3, dueDay: 15 },
  { year: 2026, month: 7, closingDay: 3, dueDay: 14 },
  { year: 2026, month: 8, closingDay: 3, dueDay: 17 },
  { year: 2026, month: 9, closingDay: 3, dueDay: 14 },
  { year: 2026, month: 10, closingDay: 5, dueDay: 19 },
  { year: 2026, month: 11, closingDay: 3, dueDay: 16 },
  { year: 2026, month: 12, closingDay: 3, dueDay: 14 },
];

/** Valores por defecto si no hay calendario (último mes del listado). */
export function fallbackDaysFromSchedule(
  schedule: CreditCardMonthEntry[],
): { closingDay: number; dueDay: number } {
  const last = schedule[schedule.length - 1];
  return { closingDay: last.closingDay, dueDay: last.dueDay };
}
