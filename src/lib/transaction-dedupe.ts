import { resolveDefaultCurrency } from "./format";
import type { AppSettings, CurrencyCode, Transaction } from "./types";

function normDesc(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Día calendario estable para la clave (ISO YYYY-MM-DD del string almacenado). */
function dateKey(iso: string): string {
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Clave estable para detectar el mismo movimiento (p. ej. mismo import dos veces).
 */
export function transactionDedupeKey(
  t: Omit<Transaction, "id">,
  defaultCurrency: CurrencyCode,
): string {
  const cur = t.currency ?? defaultCurrency;
  const amt = Math.round(t.amount * 100) / 100;
  return [
    dateKey(t.date),
    t.type,
    String(amt),
    cur,
    (t.category ?? "").trim(),
    normDesc(t.description),
    t.paymentMethod,
    t.cardId ?? "",
  ].join("\x1f");
}

/**
 * Deja una sola fila por clave; conserva la primera en orden fecha descendente
 * (suele ser la última importada / más reciente en la lista).
 */
export function dedupeTransactionsByKey(
  list: Transaction[],
  settings: AppSettings,
): Transaction[] {
  const dc = resolveDefaultCurrency(settings);
  const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));
  const seen = new Set<string>();
  const out: Transaction[] = [];
  for (const t of sorted) {
    const k = transactionDedupeKey(t, dc);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
