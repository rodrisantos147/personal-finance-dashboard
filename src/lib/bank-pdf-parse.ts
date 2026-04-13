import type { CsvImportResult, CsvImportPreviewRow } from "./csv-import";
import { parseDateFlexible, parseMoneyAR } from "./csv-import";

const SKIP_LINE =
  /^(fecha|detalle|concepto|saldo|total|extracto|itau|itáu|página|page|movimiento|d[eé]bito|c[ré]dito|importe)\b/i;

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
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i].replace(/^(ARS|UYU|\$)$/i, "");
    const n = parseMoneyAR(p);
    if (Number.isFinite(n) && n !== 0) {
      amountIdx = i;
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

  const type = signed < 0 ? "expense" : "income";
  return {
    line: lineNo,
    date: d.toISOString(),
    description: descPart.slice(0, 280) || "Movimiento",
    type,
    amount: Math.abs(signed),
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

  if (absDeb > 0) {
    return {
      line: lineNo,
      date: d.toISOString(),
      description: desc.slice(0, 280) || "Egreso",
      type: "expense",
      amount: absDeb,
      raw: t,
    };
  }
  return {
    line: lineNo,
    date: d.toISOString(),
    description: desc.slice(0, 280) || "Ingreso",
    type: "income",
    amount: absCred,
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

    const key = `${row.date}-${row.description}-${row.amount}-${row.type}`;
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
        "No detecté movimientos con fecha DD/MM/AAAA y monto. Probá exportar CSV desde Itaú, o copiá la tabla al portapapeles y pegala en “Importar CSV”.",
    };
  }

  rows.sort((a, b) => b.date.localeCompare(a.date));
  return { ok: true, rows, skipped };
}
