import type { AppSettings } from "./types";

export function formatMoney(amount: number, settings: AppSettings) {
  return new Intl.NumberFormat(settings.locale, {
    style: "currency",
    currency: settings.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
