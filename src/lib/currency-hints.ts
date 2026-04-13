import type { CurrencyCode } from "./types";

/** True si el string parece un importe distinto de cero (sin parsear bien miles). */
function amountLooksNonZero(amountStr: string): boolean {
  const s = amountStr.replace(/[$\u00A0\s]/g, "").trim();
  if (!s) return false;
  const digits = s.replace(/[^0-9]/g, "");
  if (!digits) return false;
  return !/^0+$/.test(digits);
}

/** Formato 1.234,56 o 123,45 → pesos; 12.99 o 1,234.56 → USD típico en TC. */
export function inferCurrencyFromAmountFormat(
  amountStr: string,
): CurrencyCode | undefined {
  const s = amountStr.trim().replace(/[$\u00A0\s]/g, "");
  if (!s) return undefined;
  if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(s) || /^\d+,\d{2}$/.test(s)) return "UYU";
  if (/^\d{1,3}(,\d{3})*\.\d{2}$/.test(s)) return "USD";
  if (/^\d{1,4}\.\d{2}$/.test(s)) return "USD";
  return undefined;
}

/**
 * Prioridad: columna moneda explícita → formato del importe (columnas monto) →
 * US$/EUR en texto → SaaS USD → default.
 *
 * El formato del monto va **antes** que `US$` en la misma línea: muchos extractos
 * uruguayos muestran pesos + equivalente en dólares; si priorizáramos el texto,
 * el importe en pesos quedaría mal como USD y al pasar el informe a UYU se
 * multiplicaría de nuevo por el tipo de cambio (~×33–42).
 */
export function resolveImportRowCurrency(
  description: string,
  amountParts: string[],
  extraHints: string[] = [],
  defaultCurrency: CurrencyCode = "UYU",
  explicitColumn?: CurrencyCode,
): CurrencyCode {
  if (explicitColumn) return explicitColumn;
  for (const a of amountParts) {
    if (!amountLooksNonZero(a)) continue;
    const f = inferCurrencyFromAmountFormat(a);
    if (f) return f;
  }
  const all = [description, ...amountParts, ...extraHints].filter(Boolean);
  const fromMoney = inferCurrencyFromMoneyStrings(...all);
  if (fromMoney) return fromMoney;
  const fromDesc = inferCurrencyFromDescriptionAndHints(description, ...extraHints);
  if (fromDesc) return fromDesc;
  return defaultCurrency;
}

export function inferCurrencyFromMoneyStrings(
  ...raws: string[]
): CurrencyCode | undefined {
  for (const raw of raws) {
    const u = raw.toUpperCase();
    if (/\b(US\$|U\$S|USD)\b/.test(u) || u.includes("US$")) return "USD";
    if (/\b(DOLAR|DOLARES|DÓLAR|DÓLARES)\b/.test(u)) return "USD";
    if (/\bEUR\b|€/.test(u)) return "EUR";
  }
  return undefined;
}

/**
 * Moneda explícita en el texto + cargos típicos en USD (SaaS / TC internacional).
 */
export function inferCurrencyFromDescriptionAndHints(
  ...parts: string[]
): CurrencyCode | undefined {
  const fromMoney = inferCurrencyFromMoneyStrings(...parts);
  if (fromMoney) return fromMoney;
  const blob = parts.filter(Boolean).join(" ");
  if (!blob.trim()) return undefined;
  if (
    /\bSPOTIFY\b|\bREPLIT\b|\bCLOUDFLARE\b|\bGITHUB\b|\bOPENAI\b|\*OPENAI|OPENAI\*|\bCHATGPT\b|\bFIGMA\b|\bVERCEL\b|\bDIGITALOCEAN\b|\bSUPABASE\b|\bNOTION\b|\bANTHROPIC\b|\bCLAUDE\.AI\b|\bCURSOR\b|\bCURSOR\s+USAGE\b/i.test(
      blob,
    )
  ) {
    return "USD";
  }
  return undefined;
}
