import type { PaymentMethod, TransactionType } from "./types";

export type SingleAmountConvention =
  | "signed"
  | "always_expense"
  | "always_income";

export type CsvImportPreviewRow = {
  line: number;
  date: string;
  description: string;
  type: TransactionType;
  amount: number;
  raw?: string;
};

export type CsvImportResult =
  | { ok: true; rows: CsvImportPreviewRow[]; skipped: number }
  | { ok: false; error: string };

function normHeader(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/** Detecta `,` o `;` según la primera línea con datos. */
function detectDelimiter(sample: string): string {
  const line = sample.split(/\r?\n/).find((l) => l.trim().length) ?? "";
  const commas = (line.match(/,/g) ?? []).length;
  const semis = (line.match(/;/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (!inQ && c === delim) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

export function parseCsvRows(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const delim = detectDelimiter(text);
  return lines.map((l) => splitCsvLine(l, delim));
}

/** Montos tipo 1.234,56 o -500 o (500) — devuelve número con signo si aplica. */
export function parseMoneyAR(raw: string): number {
  let s = raw.replace(/[$\u00A0\s]/g, "").trim();
  if (!s) return NaN;
  let neg = s.startsWith("-");
  if (s.startsWith("(") && s.endsWith(")")) {
    neg = true;
    s = s.slice(1, -1);
  } else {
    s = s.replace(/^-/, "");
  }
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      s = parts[0].replace(/\./g, "") + "." + parts[1];
    } else {
      s = s.replace(/,/g, "");
    }
  } else {
    s = s.replace(/\.(?=\d{3}\b)/g, "");
  }
  let n = Number(s);
  if (!Number.isFinite(n)) return NaN;
  if (neg) n = -n;
  return n;
}

/** Para columnas débito/crédito siempre positivas. */
export function parseMoneyARAbsolute(raw: string): number {
  const n = parseMoneyAR(raw);
  return Number.isFinite(n) ? Math.abs(n) : NaN;
}

function parseDateFlexible(raw: string): Date | null {
  const t = raw.trim();
  if (!t) return null;
  const m1 = t.match(
    /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/,
  );
  if (m1) {
    let d = +m1[1];
    let mo = +m1[2];
    let y = +m1[3];
    if (y < 100) y += 2000;
    if (mo > 12) {
      const tmp = d;
      d = mo;
      mo = tmp;
    }
    return new Date(y, mo - 1, d);
  }
  const m2 = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return new Date(+m2[1], +m2[2] - 1, +m2[3]);
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

const ALIAS = {
  fecha: ["fecha", "fechavalor", "fmov", "fvencimiento", "date"],
  descripcion: [
    "descripcion",
    "detalle",
    "concepto",
    "movimiento",
    "referencia",
    "nombre",
  ],
  debito: ["debito", "debe", "cargos", "egreso", "salida"],
  credito: ["credito", "haber", "abonos", "ingreso", "entrada"],
  monto: ["monto", "importe", "valor", "amount", "cantidad"],
  tipo: ["tipo", "tipomovimiento", "clase"],
};

function findColumnIndex(
  headers: string[],
  keys: string[],
): number | undefined {
  const n = headers.map(normHeader);
  for (let i = 0; i < n.length; i++) {
    if (keys.some((k) => n[i] === k || n[i].includes(k))) return i;
  }
  for (let i = 0; i < n.length; i++) {
    for (const k of keys) {
      if (n[i].startsWith(k) || n[i].endsWith(k)) return i;
    }
  }
  return undefined;
}

function inferTipo(
  raw: string,
): "income" | "expense" | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = normHeader(raw);
  if (n === "d" || n === "db" || n === "deb" || n === "dr") return "expense";
  if (n === "c" || n === "cr" || n === "cred" || n === "hab") return "income";
  if (/ingreso|credito|haber|abono|entrada|credit/i.test(n)) return "income";
  if (/egreso|debito|debe|cargo|salida|debit/i.test(n)) return "expense";
  return undefined;
}

/**
 * Interpreta exportaciones de banco (débito/crédito o monto único) o CSV simple.
 */
export function parseBankCsv(
  text: string,
  singleAmountConvention: SingleAmountConvention,
): CsvImportResult {
  const rows = parseCsvRows(text);
  if (rows.length < 2) {
    return { ok: false, error: "El archivo debe tener encabezados y al menos una fila." };
  }

  const headers = rows[0].map((h) => h.trim());
  const hNorm = headers.map(normHeader);

  let iFecha = findColumnIndex(headers, ALIAS.fecha);
  let iDesc = findColumnIndex(headers, ALIAS.descripcion);
  const iDeb = findColumnIndex(headers, ALIAS.debito);
  const iCred = findColumnIndex(headers, ALIAS.credito);
  let iMonto = findColumnIndex(headers, ALIAS.monto);
  const iTipo = findColumnIndex(headers, ALIAS.tipo);

  if (iFecha === undefined) {
    return {
      ok: false,
      error:
        "No encontré una columna de fecha (buscá: Fecha, Fecha valor, Date…).",
    };
  }
  if (iDesc === undefined) {
    iDesc = hNorm.findIndex(
      (_, i) =>
        i !== iFecha &&
        i !== iDeb &&
        i !== iCred &&
        i !== iMonto &&
        i !== iTipo,
    );
    if (iDesc < 0) iDesc = 0;
  }

  const hasDebCred =
    iDeb !== undefined && iCred !== undefined;
  const hasMonto = iMonto !== undefined;

  if (!hasDebCred && !hasMonto) {
    return {
      ok: false,
      error:
        "Necesito columnas Débito y Crédito, o una columna Monto / Importe.",
    };
  }

  const mode: "deb_cred" | "single" = hasDebCred ? "deb_cred" : "single";

  const out: CsvImportPreviewRow[] = [];
  let skipped = 0;

  for (let r = 1; r < rows.length; r++) {
    const line = r + 1;
    const cells = rows[r];
    if (cells.every((c) => !String(c).trim())) {
      skipped++;
      continue;
    }

    const ds = cells[iFecha] ?? "";
    const d = parseDateFlexible(ds);
    if (!d) {
      skipped++;
      continue;
    }

    const description = String(cells[iDesc] ?? "").trim() || "Sin descripción";

    let type: TransactionType;
    let amount = 0;

    if (mode === "deb_cred" && iDeb !== undefined && iCred !== undefined) {
      const rawD = String(cells[iDeb] ?? "").trim();
      const rawC = String(cells[iCred] ?? "").trim();
      const deb = rawD ? Math.abs(parseMoneyARAbsolute(rawD)) : 0;
      const cred = rawC ? Math.abs(parseMoneyARAbsolute(rawC)) : 0;
      if (deb > 0 && cred > 0) {
        skipped++;
        continue;
      }
      if (deb > 0) {
        type = "expense";
        amount = deb;
      } else if (cred > 0) {
        type = "income";
        amount = cred;
      } else {
        skipped++;
        continue;
      }
    } else if (iMonto !== undefined) {
      const rawM = String(cells[iMonto] ?? "").trim();
      const signed = parseMoneyAR(rawM);
      if (!Number.isFinite(signed) || signed === 0) {
        skipped++;
        continue;
      }
      const tipoCell = iTipo !== undefined ? String(cells[iTipo] ?? "").trim() : "";
      const inferred = inferTipo(tipoCell);
      if (inferred) {
        type = inferred;
        amount = Math.abs(signed);
      } else if (singleAmountConvention === "signed") {
        type = signed < 0 ? "expense" : "income";
        amount = Math.abs(signed);
      } else if (singleAmountConvention === "always_expense") {
        type = "expense";
        amount = Math.abs(signed);
      } else {
        type = "income";
        amount = Math.abs(signed);
      }
    } else {
      skipped++;
      continue;
    }

    out.push({
      line,
      date: d.toISOString(),
      description,
      type,
      amount,
    });
  }

  if (out.length === 0) {
    return {
      ok: false,
      error:
        "No se pudo leer ningún movimiento. Revisá separadores (; o ,) y fechas.",
    };
  }

  return { ok: true, rows: out, skipped };
}
