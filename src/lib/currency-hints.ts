import type { CurrencyCode } from "./types";

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
