import type { CsvImportResult, CsvImportPreviewRow } from "./csv-import";
import { inferCurrencyFromDescriptionAndHints } from "./currency-hints";
import { parseDateFlexible, parseMoneyAR } from "./csv-import";
import { shouldReclassifyIncomeAsCardExpense } from "./finance";
import type { CurrencyCode } from "./types";
import type { TransactionType } from "./types";

const SKIP_LINE =
  /^(fecha|detalle|concepto|saldo|total|extracto|itau|itáu|página|page|movimiento|d[eé]bito|c[ré]dito|importe)\b/i;

/** Fecha tipo 07NOV (extractos Itaú Uruguay / varios PDF). */
const DD_MON_LINE =
  /^(\d{1,2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(?:\s+(.*))?$/i;

/** Fecha con año en encabezado: 28NOV2025 */
const DD_MON_YYYY =
  /\b(\d{1,2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{4})\b/i;

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

function inferYearFromText(text: string): number {
  const m = text.match(DD_MON_YYYY);
  if (m) return parseInt(m[3], 10);
  return new Date().getFullYear();
}

/** Monto uruguayo típico: 21.000,00 o 1,48 */
function looksLikeUyAmount(s: string): boolean {
  const t = s.trim();
  return /^\d{1,3}(\.\d{3})*,\d{2}$/.test(t) || /^\d+,\d{2}$/.test(t);
}

/** Incluye montos USD típicos en extractos TC (12.99 o 1,234.56). */
function looksLikeAmountLine(s: string): boolean {
  const t = s.trim();
  if (looksLikeUyAmount(t)) return true;
  return (
    /^\d+\.\d{2}$/.test(t) ||
    /^\d{1,3}(,\d{3})*\.\d{2}$/.test(t) ||
    /^\d{1,3}(\.\d{3})*\.\d{2}$/.test(t)
  );
}

function classifyItauUy(desc: string): TransactionType {
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

function shouldSkipItauDescription(desc: string): boolean {
  const u = desc.toUpperCase();
  if (desc.length < 2) return true;
  if (/^SDO\.|^SALDO\s|^SIN MOVIMIENTOS/i.test(u)) return true;
  if (/^TRANSPORTE$/i.test(desc)) return true;
  if (/NO PAGA INTERESES|SALDO PROMEDIO|CANTIDAD DE MOV/i.test(u)) return true;
  return false;
}

/**
 * Parser para PDF Itaú Uruguay: líneas "07NOV", bloques de concepto y montos UY.
 */
export function parseItauUruguayPdfText(text: string): {
  rows: CsvImportPreviewRow[];
  skipped: number;
} {
  const lines = text
    .split(/\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const year = inferYearFromText(text);
  const rows: CsvImportPreviewRow[] = [];
  let skipped = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const dm = line.match(DD_MON_LINE);
    if (!dm) {
      i++;
      continue;
    }

    const day = parseInt(dm[1], 10);
    const mo = monthIndex(dm[2]);
    if (mo < 0 || day < 1 || day > 31) {
      i++;
      skipped++;
      continue;
    }

    i++;
    const descLines: string[] = [];
    const restSameLine = (dm[3] || "").trim();
    if (restSameLine) descLines.push(restSameLine);

    while (i < lines.length) {
      const L = lines[i];
      if (DD_MON_LINE.test(L)) break;
      if (looksLikeAmountLine(L)) break;
      if (L.length > 0) descLines.push(L);
      i++;
    }

    if (i >= lines.length || !looksLikeAmountLine(lines[i])) {
      skipped++;
      continue;
    }

    const description = descLines.join(" ").trim();
    if (shouldSkipItauDescription(description)) {
      while (i < lines.length && looksLikeAmountLine(lines[i])) {
        i++;
      }
      skipped++;
      continue;
    }

    const amountStr1 = lines[i];
    i++;
    let amountStr2: string | undefined;
    if (i < lines.length && looksLikeAmountLine(lines[i])) {
      amountStr2 = lines[i];
      i++;
    }

    const descShort = description.slice(0, 280);
    let type: TransactionType;
    let amount: number;

    if (amountStr2 !== undefined) {
      const n1 = parseMoneyAR(amountStr1);
      const n2 = parseMoneyAR(amountStr2);
      const abs1 = Number.isFinite(n1) ? Math.abs(n1) : 0;
      const abs2 = Number.isFinite(n2) ? Math.abs(n2) : 0;
      if (abs1 > 0 && abs2 > 0) {
        skipped++;
        continue;
      }
      if (abs1 === 0 && abs2 === 0) {
        skipped++;
        continue;
      }
      /** Orden típico extracto Itaú UY al copiar: débito, luego crédito. */
      if (abs1 > 0 && abs2 === 0) {
        type = "expense";
        amount = abs1;
      } else {
        type = "income";
        amount = abs2;
      }
    } else {
      const signed = parseMoneyAR(amountStr1);
      if (!Number.isFinite(signed) || signed === 0) {
        skipped++;
        continue;
      }
      amount = Math.abs(signed);
      type = classifyItauUy(description);
      if (signed < 0) {
        type = "expense";
      }
    }

    const d = new Date(year, mo, day);
    if (
      type === "income" &&
      shouldReclassifyIncomeAsCardExpense({
        type,
        description: descShort,
      })
    ) {
      type = "expense";
    }

    const rowCur: CurrencyCode =
      inferCurrencyFromDescriptionAndHints(
        line,
        description,
        amountStr1,
        amountStr2 ?? "",
      ) ?? "UYU";

    rows.push({
      line: i,
      date: d.toISOString(),
      description: descShort,
      type,
      amount,
      currency: rowCur,
      raw: `${line} | ${description} | ${amountStr1}${amountStr2 ? ` | ${amountStr2}` : ""}`,
    });
  }

  return { rows, skipped };
}

/** Línea con fecha al inicio y un monto (tomamos el último token monetario). */
function parseSingleLine(line: string, lineNo: number): CsvImportPreviewRow | null {
  const t = line.replace(/\s+/g, " ").trim();
  const mDate = t.match(/^(\d{2}\/\d{2}\/\d{4})/);
  if (!mDate) return null;

  const datePart = mDate[1];
  const afterDate = t.slice(datePart.length).trim();
  const parts = afterDate.split(/\s+/).filter(Boolean);
  if (parts.length < 1) return null;

  let amountIdx = -1;
  for (let j = parts.length - 1; j >= 0; j--) {
    const p = parts[j].replace(/^(ARS|UYU|USD|US\$|U\$S|\$)$/i, "");
    const n = parseMoneyAR(p);
    if (Number.isFinite(n) && n !== 0) {
      amountIdx = j;
      break;
    }
  }
  if (amountIdx < 0) return null;

  const amountRaw = parts[amountIdx];
  const descPart = parts.slice(0, amountIdx).join(" ").trim();

  if (SKIP_LINE.test(descPart) || descPart.length < 2) return null;

  const d = parseDateFlexible(datePart);
  const signed = parseMoneyAR(amountRaw);
  if (!d || !Number.isFinite(signed) || signed === 0) return null;

  let type: TransactionType = signed < 0 ? "expense" : "income";
  const desc = descPart.slice(0, 280) || "Movimiento";
  if (
    type === "income" &&
    shouldReclassifyIncomeAsCardExpense({ type, description: desc })
  ) {
    type = "expense";
  }
  const cur: CurrencyCode =
    inferCurrencyFromDescriptionAndHints(t, amountRaw) ?? "UYU";
  return {
    line: lineNo,
    date: d.toISOString(),
    description: desc,
    type,
    amount: Math.abs(signed),
    currency: cur,
    raw: t,
  };
}

/**
 * Dos montos al final: débito y crédito (orden típico: … débito crédito).
 */
function parseDebitCreditLine(line: string, lineNo: number): CsvImportPreviewRow | null {
  const t = line.replace(/\s+/g, " ").trim();
  const mDate = t.match(/^(\d{2}\/\d{2}\/\d{4})/);
  if (!mDate) return null;

  const datePart = mDate[1];
  const rest = t.slice(datePart.length).trim();
  const parts = rest.split(/\s+/).filter(Boolean);
  if (parts.length < 3) return null;

  const rawDeb = parts[parts.length - 2];
  const rawCred = parts[parts.length - 1];
  const deb = parseMoneyAR(rawDeb);
  const cred = parseMoneyAR(rawCred);
  if (!Number.isFinite(deb) || !Number.isFinite(cred)) return null;

  const absDeb = Math.abs(deb);
  const absCred = Math.abs(cred);
  if (absDeb === 0 && absCred === 0) return null;
  if (absDeb > 0 && absCred > 0) return null;

  const desc = parts.slice(0, -2).join(" ").trim();
  if (desc.length < 2 || SKIP_LINE.test(desc)) return null;

  const d = parseDateFlexible(datePart);
  if (!d) return null;

  const cur: CurrencyCode =
    inferCurrencyFromDescriptionAndHints(t, rawDeb, rawCred) ?? "UYU";

  if (absDeb > 0) {
    return {
      line: lineNo,
      date: d.toISOString(),
      description: desc.slice(0, 280) || "Egreso",
      type: "expense",
      amount: absDeb,
      currency: cur,
      raw: t,
    };
  }
  const descCred = desc.slice(0, 280) || "Ingreso";
  let typeCred: TransactionType = "income";
  if (
    shouldReclassifyIncomeAsCardExpense({
      type: "income",
      description: descCred,
    })
  ) {
    typeCred = "expense";
  }
  return {
    line: lineNo,
    date: d.toISOString(),
    description: descCred,
    type: typeCred,
    amount: absCred,
    currency: cur,
    raw: t,
  };
}

/**
 * Intenta extraer movimientos de texto copiado desde PDF (Itaú y similares).
 */
export function parseBankStatementPdfText(text: string): CsvImportResult {
  const rawLines = text
    .split(/\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const rows: CsvImportPreviewRow[] = [];
  let skipped = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const lineNo = i + 1;
    if (SKIP_LINE.test(line)) {
      skipped++;
      continue;
    }

    const row =
      parseDebitCreditLine(line, lineNo) ?? parseSingleLine(line, lineNo);
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

  if (rows.length > 0) {
    rows.sort((a, b) => b.date.localeCompare(a.date));
    return { ok: true, rows, skipped };
  }

  const itau = parseItauUruguayPdfText(text);
  if (itau.rows.length > 0) {
    const dedup: CsvImportPreviewRow[] = [];
    const seen2 = new Set<string>();
    for (const r of itau.rows) {
      const key = `${r.date}-${r.description}-${r.amount}-${r.type}-${r.currency ?? ""}`;
      if (seen2.has(key)) continue;
      seen2.add(key);
      dedup.push(r);
    }
    dedup.sort((a, b) => b.date.localeCompare(a.date));
    return { ok: true, rows: dedup, skipped: itau.skipped };
  }

  return {
    ok: false,
    error:
      "No detecté movimientos. Formatos soportados: fecha DD/MM/AAAA, o extracto Itaú UY (ej. 07NOV + montos 1.234,56). Si el PDF es solo imagen, exportá CSV desde el banco.",
  };
}
