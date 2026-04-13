"use client";

import { useMemo, useState } from "react";
import { parseBankStatementPdfText } from "@/lib/bank-pdf-parse";
import {
  parseBankCsv,
  type CsvImportPreviewRow,
  type CsvImportResult,
  type SingleAmountConvention,
} from "@/lib/csv-import";
import { formatMoneyWithSettings } from "@/lib/format";
import { inferOmitFromPeriodSummary } from "@/lib/finance";
import { extractTextFromPdfFile } from "@/lib/pdf-extract";
import { useFinanceStore } from "@/lib/store";
import type { CurrencyCode, PaymentMethod } from "@/lib/types";

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "debit", label: "Débito" },
  { id: "credit", label: "Crédito" },
  { id: "cash", label: "Efectivo" },
  { id: "transfer", label: "Transferencia" },
];

function pickParseResult(
  text: string,
  preferPdf: boolean,
  convention: SingleAmountConvention,
  importCurrency: CurrencyCode,
): CsvImportResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: "No hay texto para analizar." };
  }
  const csv = parseBankCsv(trimmed, convention, importCurrency);
  const pdf = parseBankStatementPdfText(trimmed);

  const csvOk = csv.ok && csv.rows.length > 0;
  const pdfOk = pdf.ok && pdf.rows.length > 0;

  if (preferPdf) {
    if (pdfOk) return pdf;
    if (csvOk) return csv;
  } else {
    if (csvOk) return csv;
    if (pdfOk) return pdf;
  }

  if (!csv.ok && !pdf.ok) {
    return {
      ok: false,
      error: `${csv.error}\n\n${pdf.error}`,
    };
  }
  return {
    ok: false,
    error:
      "No se detectaron movimientos. Probá CSV exportado del banco o un PDF con texto seleccionable (no imagen).",
  };
}

export function StatementImport() {
  const settings = useFinanceStore((s) => s.settings);
  const expenseCategories = useFinanceStore((s) => s.expenseCategories);
  const importTransactions = useFinanceStore((s) => s.importTransactions);

  const [rawText, setRawText] = useState("");
  const [preferPdf, setPreferPdf] = useState(false);
  const [busy, setBusy] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [convention, setConvention] =
    useState<SingleAmountConvention>("signed");
  const [catExpense, setCatExpense] = useState("Otros");
  const [catIncome, setCatIncome] = useState("Ingreso");
  const [payExpense, setPayExpense] = useState<PaymentMethod>("debit");
  const [payIncome, setPayIncome] = useState<PaymentMethod>("transfer");
  const parsed = useMemo(
    () => pickParseResult(rawText, preferPdf, convention, "UYU"),
    [rawText, preferPdf, convention],
  );

  const previewRows = parsed.ok ? parsed.rows : [];

  function fmtPreview(n: number, c: CurrencyCode) {
    return formatMoneyWithSettings(n, settings, c);
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    setParseError(null);
    setBusy(true);
    const name = f.name.toLowerCase();
    const isPdf =
      name.endsWith(".pdf") || f.type === "application/pdf";
    setPreferPdf(isPdf);
    try {
      const text = isPdf
        ? await extractTextFromPdfFile(f)
        : await f.text();
      setRawText(text);
    } catch (e) {
      setRawText("");
      setParseError(
        e instanceof Error
          ? e.message
          : "No se pudo leer el archivo. Probá otro formato.",
      );
    } finally {
      setBusy(false);
    }
  }

  function applyImport() {
    if (!parsed.ok) return;
    const rows = parsed.rows;
    const {
      added,
      skippedDuplicates,
      removedDuplicates,
    } = importTransactions(
      rows.map((r) => ({
        type: r.type,
        amount: r.amount,
        currency: r.currency ?? "UYU",
        category: r.type === "expense" ? catExpense : catIncome,
        date: r.date,
        paymentMethod: r.type === "expense" ? payExpense : payIncome,
        description: r.description,
        isPending: false,
        ...(inferOmitFromPeriodSummary(r.type, r.description)
          ? { omitFromPeriodSummary: true }
          : {}),
      })),
    );
    setRawText("");
    const parts = [
      `Agregados ${added}.`,
      skippedDuplicates
        ? `Omitidos ${skippedDuplicates} que ya estaban en el historial.`
        : null,
      removedDuplicates
        ? `Eliminados ${removedDuplicates} duplicados internos.`
        : null,
    ].filter(Boolean);
    alert(parts.join(" "));
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
      <h2 className="text-lg font-medium text-white">
        Importar extracto (CSV o PDF)
      </h2>
      <p className="mt-2 text-sm text-zinc-500">
        Un solo archivo: CSV o PDF con texto. Los PDF de{" "}
        <strong className="text-zinc-400">Itaú Uruguay</strong> (estado Visa
        ****8002, resumen cuenta URGP, etc.) se interpretan con un parser
        dedicado. Si un formato falla, se prueba el otro. Los duplicados se
        unifican al importar.
      </p>

      <label className="mt-4 block text-sm text-zinc-400">
        Archivo
        <input
          type="file"
          accept=".pdf,.csv,.txt,text/csv,application/pdf"
          disabled={busy}
          className="mt-1 block w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-2 file:text-sm file:text-white disabled:opacity-50"
          onChange={(e) => {
            const f = e.target.files?.[0];
            void onFile(f);
            e.target.value = "";
          }}
        />
      </label>
      {busy && (
        <p className="mt-2 text-xs text-zinc-500">Leyendo archivo…</p>
      )}

      <label className="mt-4 block text-sm text-zinc-400">
        O pegá el contenido
        <textarea
          value={rawText}
          onChange={(e) => {
            setRawText(e.target.value);
            setParseError(null);
          }}
          rows={5}
          placeholder="Pegá filas CSV o texto copiado del PDF…"
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-200"
        />
      </label>

      <details className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
        <summary className="cursor-pointer text-sm text-zinc-400">
          Opciones (categorías, débito/crédito)
        </summary>
        <p className="mt-2 text-xs text-zinc-600">
          Moneda por defecto del CSV: <strong className="text-zinc-500">pesos uruguayos</strong>
          . Los importes en USD en extractos se detectan por columna o texto.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-500">Monto único (sin déb./créd.)</span>
            <select
              value={convention}
              onChange={(e) =>
                setConvention(e.target.value as SingleAmountConvention)
              }
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            >
              <option value="signed">Signo + contexto</option>
              <option value="always_expense">Solo egresos</option>
              <option value="always_income">Solo ingresos</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-zinc-500">Categoría egresos</span>
              <select
                value={catExpense}
                onChange={(e) => setCatExpense(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-white"
              >
                {expenseCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-zinc-500">Categoría ingresos</span>
              <input
                value={catIncome}
                onChange={(e) => setCatIncome(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-white"
              />
            </label>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-500">Medio — egresos</span>
            <select
              value={payExpense}
              onChange={(e) =>
                setPayExpense(e.target.value as PaymentMethod)
              }
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            >
              {METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-500">Medio — ingresos</span>
            <select
              value={payIncome}
              onChange={(e) =>
                setPayIncome(e.target.value as PaymentMethod)
              }
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            >
              {METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>

      {parseError && (
        <p className="mt-4 rounded-lg border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
          {parseError}
        </p>
      )}

      {parsed && !parsed.ok && !parseError && (
        <p className="mt-4 rounded-lg border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
          {parsed.error}
        </p>
      )}

      {parsed.ok && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-zinc-400">
            Listos:{" "}
            <strong className="text-white">{parsed.rows.length}</strong>{" "}
            movimientos
            {parsed.skipped > 0 && (
              <>
                {" "}
                ({parsed.skipped} líneas sin usar)
              </>
            )}
            .
          </p>
          <div className="max-h-56 overflow-auto rounded-lg border border-zinc-800">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead className="sticky top-0 bg-zinc-950 text-zinc-500">
                <tr>
                  <th className="px-2 py-2">Fecha</th>
                  <th className="px-2 py-2">Tipo</th>
                  <th className="px-2 py-2">Descripción</th>
                  <th className="px-2 py-2">Mon.</th>
                  <th className="px-2 py-2 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {previewRows.slice(0, 20).map((r: CsvImportPreviewRow) => (
                  <tr key={r.line}>
                    <td className="px-2 py-1.5 text-zinc-400">
                      {new Date(r.date).toLocaleDateString("es-AR")}
                    </td>
                    <td className="px-2 py-1.5">
                      {r.type === "income" ? (
                        <span className="text-emerald-400">Ingreso</span>
                      ) : (
                        <span className="text-rose-300">Egreso</span>
                      )}
                    </td>
                    <td className="max-w-[200px] truncate px-2 py-1.5 text-zinc-300">
                      {r.description}
                    </td>
                    <td className="px-2 py-1.5 text-zinc-500">
                      {r.currency ?? "UYU"}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-zinc-200">
                      {fmtPreview(r.amount, r.currency ?? "UYU")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {previewRows.length > 20 && (
            <p className="text-xs text-zinc-600">
              Mostrando 20 de {previewRows.length}…
            </p>
          )}
          <button
            type="button"
            className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
            onClick={applyImport}
          >
            Importar movimientos
          </button>
        </div>
      )}
    </section>
  );
}
