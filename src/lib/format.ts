import type { AppSettings, CurrencyCode, Transaction } from "./types";

/** Resuelve moneda por defecto (migración desde `settings.currency`). */
export function resolveDefaultCurrency(settings: AppSettings): CurrencyCode {
  return (
    settings.defaultCurrency ??
    (settings.currency as CurrencyCode | undefined) ??
    "UYU"
  );
}

export function txCurrency(
  t: Transaction,
  settings: AppSettings,
): CurrencyCode {
  const raw = t.currency ?? resolveDefaultCurrency(settings);
  if (raw === "ARS" && (settings.treatArsAsUyu ?? true)) {
    return "UYU";
  }
  return raw;
}

export function formatMoney(
  amount: number,
  currency: CurrencyCode,
  locale: string,
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Atajo usando ajustes (usa moneda explícita, no la “default” del usuario). */
export function formatMoneyWithSettings(
  amount: number,
  settings: AppSettings,
  currency: CurrencyCode,
) {
  return formatMoney(amount, currency, settings.locale);
}
