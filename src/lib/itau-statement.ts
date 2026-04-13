/**
 * Parser de estados de cuenta Itaú Uruguay extraídos de PDF (texto).
 * Cubre:
 * - Visa / TC: "DD MM YY [8002] comercio … montos"
 * - Cuenta URGP: "DDMON concepto … monto movimiento … saldo"
 *
 * El PDF suele entregar todo en pocas líneas largas; tokenizamos antes de parsear.
 */

import type { CsvImportPreviewRow, CsvImportResult } from "./csv-import";
import { parseMoneyAR } from "./csv-import";
import {
  inferCurrencyFromAmountFormat,
  resolveImportRowCurrency,
} from "./currency-hints";
import {
  shouldReclassifyIncomeAsCardExpense,
  shouldTreatPositiveAmountAsExpense,
} from "./finance";
import type { CurrencyCode, TransactionType } from "./types";

const MONTHS =
  "JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC";

/** Encabezado tipo 30DEC2025 (año en la misma palabra que el mes). */
const DD_MON_YYYY = new RegExp(
  `\\b(\\d{1,2})(${MONTHS})(\\d{4})\\b`,
  "i",
);

function monthIndex(mon: string): number {
  const map: Record<string, number> = {
    JAN: 0,
    FEB: 1,
    MAR: 2,
    APR: 3,
    MAY: 4,
    JUN: 5,
    JUL: 6,
    AUG: 7,
    SEP: 8,
    OCT: 9,
    NOV: 10,
    DEC: 11,
  };
  return map[mon.toUpperCase()] ?? -1;
}

function inferYearFromBlob(text: string): number {
  const m = text.match(DD_MON_YYYY);
  if (m) return parseInt(m[3], 10);
  return new Date().getFullYear();
}

/** Inserta saltos antes de movimientos Visa (DD MM YY …). */
function splitVisaRuns(blob: string): string {
  return blob.replace(/\s+(?=\d{2}\s+\d{2}\s+\d{2}\s+)/g, "\n");
}

/** Inserta saltos antes de movimientos cuenta (DDMON + espacio, no 30DEC2025). */
function splitCuentaRuns(blob: string): string {
  return blob.replace(
    new RegExp(
      `\\s+(?=\\d{1,2}(?:${MONTHS})\\s+)`,
      "gi",
    ),
    "\n",
  );
}

function tokenizeItauText(text: string): string[] {
  let t = text.replace(/\r/g, " ");
  t = splitVisaRuns(t);
  t = splitCuentaRuns(t);
  return t
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const SKIP_VISA = new RegExp(
  [
    "SALDO DEL ESTADO",
    "SEGURO DE VIDA",
    "UD\\.\\s+HA GENERADO",
    "MILLAS ITAU",
    "Financiá tus saldos",
    "PESOS URUGUAYOS\\s+D",
    "^VA03",
    "393418-0\\s+\\d{2}/\\d{2}/\\d{2}",
    "MONTEVIDEO, Montevideo",
    "Pago contado en pesos",
    "Pago contado en dólares",
  ].join("|"),
  "i",
);

const SKIP_CUENTA = new RegExp(
  [
    "^SDO\\.",
    "^SIN MOVIMIENTOS",
    "^TRANSPORTE$",
    "NO PAGA INTERESES",
    "SALDO PROMEDIO",
    "CANTIDAD DE MOV",
    "Total de Reduccion IVA",
    "A PARTIR DEL 1 DE OCTUBRE",
    "auditores PwC",
  ].join("|"),
  "i",
);

function looksLikeMoneyToken(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return /^-?[\d.,]+$/.test(t) && /[0-9]/.test(t);
}

/** Saca 1–4 montos desde el final de una cadena (movimiento + saldo, etc.). */
function peelTrailingAmounts(rest: string): { desc: string; amounts: string[] } {
  let s = rest.trim();
  const amounts: string[] = [];
  const re = /^(.+?)\s+(-?[\d.,]+)\s*$/;
  while (s.length > 0) {
    const m = s.match(re);
    if (!m) break;
    const tok = m[2];
    if (!looksLikeMoneyToken(tok)) break;
    amounts.unshift(tok);
    s = m[1].trim();
    if (amounts.length >= 4) break;
  }
  return { desc: s.trim(), amounts };
}

/** Clasificación alineada con classifyItauUy (bank-pdf-parse). */
function classifyCuentaMovement(desc: string): TransactionType {
  const u = desc.toUpperCase();
  if (
    /TRASPASO\s+DE|CRE\.|CREDITO|^CRE\s/i.test(u) ||
    /PRESTAMOS/i.test(u) ||
    /REDIVA/i.test(u)
  ) {
    return "income";
  }
  if (/TRASPASO\s+A|DEB\.|COMPRA|DEB\s|DEBITO/i.test(u)) {
    return "expense";
  }
  if (/TRASPASO\b/i.test(u) && !/\bTRASPASO\s+A\b/i.test(u)) {
    return "income";
  }
  return "expense";
}

function classifyVisaMovement(desc: string): TransactionType {
  const u = desc.toUpperCase();
  if (/\bPAGOS\b/i.test(u)) return "expense";
  return "expense";
}

function inferVisaCurrency(
  amountStrs: string[],
): { amount: number; currency: CurrencyCode } {
  const [a, b] = amountStrs;
  const n1 = parseMoneyAR(a);
  if (!Number.isFinite(n1)) {
    return { amount: 0, currency: "UYU" };
  }
  if (b === undefined) {
    const s = a.replace(/[$\s]/g, "").trim();
    const n = Math.abs(n1);
    if (/^\d{1,3}(\.\d{3})+,\d{2}$/.test(s)) {
      return { amount: n, currency: "UYU" };
    }
    if (n < 150 && /^\d{1,2},\d{2}$/.test(s)) {
      return { amount: n, currency: "USD" };
    }
    if (n >= 100) {
      return { amount: n, currency: "UYU" };
    }
    const hint = inferCurrencyFromAmountFormat(a);
    return { amount: n, currency: hint ?? "UYU" };
  }
  const n2 = parseMoneyAR(b);
  const abs1 = Math.abs(n1);
  const abs2 = Math.abs(n2);
  if (
    Number.isFinite(n2) &&
    Math.abs(abs1 - abs2) < 0.02 &&
    abs1 < 8000 &&
    abs2 < 8000
  ) {
    return { amount: abs1, currency: "USD" };
  }
  const uyA = inferCurrencyFromAmountFormat(a);
  const uyB = inferCurrencyFromAmountFormat(b);
  if (uyA === "UYU" && uyB !== "UYU") {
    return { amount: abs1, currency: "UYU" };
  }
  if (uyB === "UYU" && uyA !== "UYU") {
    return { amount: abs2, currency: "UYU" };
  }
  return { amount: abs1, currency: "UYU" };
}

const RE_VISA_HEAD =
  /^(\d{2})\s+(\d{2})\s+(\d{2})\s+(?:(\d{4})\s+)?(.+)$/i;

function parseVisaLine(line: string, lineNo: number): CsvImportPreviewRow | null {
  if (SKIP_VISA.test(line)) return null;
  const m = line.match(RE_VISA_HEAD);
  if (!m) return null;
  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10) - 1;
  const yy = parseInt(m[3], 10);
  const rest = m[5].trim();
  if (!rest) return null;

  const { desc, amounts } = peelTrailingAmounts(rest);
  if (amounts.length === 0) return null;

  const year = yy >= 70 ? 1900 + yy : 2000 + yy;
  const d = new Date(year, mm, dd);
  if (d.getMonth() !== mm) return null;

  const visa = inferVisaCurrency(amounts);
  if (visa.amount <= 0) return null;

  let type: TransactionType = classifyVisaMovement(desc);
  if (
    type === "income" &&
    shouldReclassifyIncomeAsCardExpense({ type, description: desc })
  ) {
    type = "expense";
  }
  if (shouldTreatPositiveAmountAsExpense(line, desc)) {
    type = "expense";
  }

  const resolved = resolveImportRowCurrency(desc, amounts, [line], "UYU");
  const currency: CurrencyCode =
    amounts.length >= 2 && visa.currency === "USD" ? "USD" : resolved;

  return {
    line: lineNo,
    date: d.toISOString(),
    description: desc.slice(0, 280) || "TC Itaú",
    type,
    amount: visa.amount,
    currency,
    raw: line,
  };
}

const RE_CUENTA_HEAD = new RegExp(
  `^(\\d{1,2})(${MONTHS})\\s+(.+)$`,
  "i",
);

function parseCuentaLine(
  line: string,
  lineNo: number,
  yearHint: number,
): CsvImportPreviewRow | null {
  const m = line.match(RE_CUENTA_HEAD);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const moStr = m[2];
  const rest = m[3].trim();
  const mo = monthIndex(moStr);
  if (mo < 0 || day < 1 || day > 31) return null;

  const { desc, amounts } = peelTrailingAmounts(rest);
  if (amounts.length === 0) return null;

  const descShort = desc.slice(0, 280);
  if (SKIP_CUENTA.test(descShort) || SKIP_CUENTA.test(line)) return null;

  if (amounts.length === 1) {
    if (/^SDO\.|^SALDO/i.test(descShort)) return null;
  }

  let txStr: string;
  if (amounts.length >= 2) {
    txStr = amounts[amounts.length - 2];
  } else {
    txStr = amounts[0];
  }

  const signed = parseMoneyAR(txStr);
  if (!Number.isFinite(signed) || signed === 0) return null;

  let type = classifyCuentaMovement(descShort);
  let amount = Math.abs(signed);
  if (signed < 0) {
    type = "expense";
  }
  if (
    signed > 0 &&
    shouldTreatPositiveAmountAsExpense(line, descShort)
  ) {
    type = "expense";
  }
  if (
    type === "income" &&
    shouldReclassifyIncomeAsCardExpense({ type, description: descShort })
  ) {
    type = "expense";
  }

  const d = new Date(yearHint, mo, day);
  const rowCur = resolveImportRowCurrency(
    descShort,
    [txStr],
    [line],
    "UYU",
  );

  return {
    line: lineNo,
    date: d.toISOString(),
    description: descShort,
    type,
    amount,
    currency: rowCur,
    raw: line,
  };
}

export function detectItauStatementText(text: string): boolean {
  const t = text.slice(0, 80_000);
  const hasBank =
    /ITAU|ITÁU|5124360|393418|URGP|ITAU FINANCI/i.test(t);
  const hasVisa = /\d{2}\s+\d{2}\s+\d{2}\s+\d{4}\s+/.test(t);
  const hasCuenta = new RegExp(
    `\\d{1,2}(?:${MONTHS})\\s+(?:CRE\\.|DEB\\.|TRASPASO|COMPRA|REDIVA)`,
    "i",
  ).test(t);
  return hasBank && (hasVisa || hasCuenta);
}

/**
 * Interpreta texto extraído de PDFs Itaú (Visa TC + cuenta pesos/dólares).
 */
export function parseItauStatementFromPdfText(text: string): CsvImportResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: "Texto vacío." };
  }

  const yearHint = inferYearFromBlob(trimmed);
  const lines = tokenizeItauText(trimmed);
  const rows: CsvImportPreviewRow[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    let row: CsvImportPreviewRow | null = parseVisaLine(line, lineNo);
    if (!row) {
      row = parseCuentaLine(line, lineNo, yearHint);
    }
    if (!row) {
      skipped++;
      continue;
    }

    const key = `${row.date}-${row.description}-${row.amount}-${row.type}-${row.currency ?? ""}`;
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    rows.push(row);
  }

  if (rows.length === 0) {
    return {
      ok: false,
      error:
        "No se detectaron movimientos Itaú en este texto. Si el PDF es imagen escaneada, no hay texto para leer.",
    };
  }

  rows.sort((a, b) => b.date.localeCompare(a.date));
  return { ok: true, rows, skipped };
}
