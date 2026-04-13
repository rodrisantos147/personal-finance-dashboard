import type { AppSettings, CurrencyCode, Transaction } from "./types";

/**
 * Normaliza moneda guardada o importada: códigos viejos pasan a UYU cuando
 * correspondía a pesos uruguayos mal etiquetados.
 */
export function normalizeStoredCurrency(
  raw: string | undefined,
  fallback: CurrencyCode,
): CurrencyCode {
  if (raw === "UYU" || raw === "USD" || raw === "EUR") return raw;
  if (raw === "ARS" || raw === "$AR") return "UYU";
  if (raw === undefined || raw === "") return fallback;
  return fallback;
}

/** Resuelve moneda por defecto (migración desde `settings.currency`). */
export function resolveDefaultCurrency(settings: AppSettings): CurrencyCode {
  const raw =
    settings.defaultCurrency ?? (settings.currency as string | undefined);
  return normalizeStoredCurrency(raw, "UYU");
}

export function txCurrency(
  t: Transaction,
  settings: AppSettings,
): CurrencyCode {
  const fallback = resolveDefaultCurrency(settings);
  return normalizeStoredCurrency(t.currency as string | undefined, fallback);
}

export function formatMoney(
  amount: number,
  currency: CurrencyCode,
  locale: string,
) {
  const opts: Intl.NumberFormatOptions = {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  };
  // El símbolo "$" para UYU se confunde con USD; mostrar el nombre de la moneda.
  if (currency === "UYU") {
    opts.currencyDisplay = "name";
  }
  return new Intl.NumberFormat(locale, opts).format(amount);
}

/** Atajo usando ajustes (usa moneda explícita, no la “default” del usuario). */
export function formatMoneyWithSettings(
  amount: number,
  settings: AppSettings,
  currency: CurrencyCode,
) {
  return formatMoney(amount, currency, settings.locale);
}
