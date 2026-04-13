import type { CurrencyCode } from "./types";

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
 * Prioridad: columna moneda explícita → US$/EUR en texto → SaaS USD → formato del monto → default.
 */
export function resolveImportRowCurrency(
  description: string,
  amountParts: string[],
  extraHints: string[] = [],
  defaultCurrency: CurrencyCode = "UYU",
  explicitColumn?: CurrencyCode,
): CurrencyCode {
  if (explicitColumn) return explicitColumn;
  const all = [description, ...amountParts, ...extraHints].filter(Boolean);
  const fromMoney = inferCurrencyFromMoneyStrings(...all);
  if (fromMoney) return fromMoney;
  const fromDesc = inferCurrencyFromDescriptionAndHints(description, ...extraHints);
  if (fromDesc) return fromDesc;
  for (const a of amountParts) {
    const f = inferCurrencyFromAmountFormat(a);
    if (f) return f;
  }
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
