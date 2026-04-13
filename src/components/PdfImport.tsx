"use client";

import { useEffect, useMemo, useState } from "react";
import { parseBankStatementPdfText } from "@/lib/bank-pdf-parse";
import type { CsvImportPreviewRow } from "@/lib/csv-import";
import { formatMoneyWithSettings, resolveDefaultCurrency } from "@/lib/format";
import { extractTextFromPdfFile } from "@/lib/pdf-extract";
import { useFinanceStore } from "@/lib/store";
import type { CurrencyCode, PaymentMethod } from "@/lib/types";

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "debit", label: "Débito" },
  { id: "credit", label: "Crédito" },
  { id: "cash", label: "Efectivo" },
  { id: "transfer", label: "Transferencia" },
];

export function PdfImport() {
  const settings = useFinanceStore((s) => s.settings);
  const expenseCategories = useFinanceStore((s) => s.expenseCategories);
  const importTransactions = useFinanceStore((s) => s.importTransactions);

  const [busy, setBusy] = useState(false);
  const [rawText, setRawText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [catExpense, setCatExpense] = useState("Otros");
  const [catIncome, setCatIncome] = useState("Ingreso");
  const [payExpense, setPayExpense] = useState<PaymentMethod>("debit");
  const [payIncome, setPayIncome] = useState<PaymentMethod>("transfer");
  const [importCurrency, setImportCurrency] = useState<CurrencyCode>(() =>
    resolveDefaultCurrency(settings),
  );

  useEffect(() => {
    setImportCurrency(resolveDefaultCurrency(settings));
  }, [settings.defaultCurrency, settings.currency]);

  const parsed = useMemo(
    () => (rawText.trim() ? parseBankStatementPdfText(rawText) : null),
    [rawText],
  );

  const previewRows =
    parsed && parsed.ok ? parsed.rows : [];

  function fmtPreview(n: number, c: CurrencyCode) {
    return formatMoneyWithSettings(n, settings, c);
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    setParseError(null);
    setRawText("");
    setBusy(true);
    try {
      const text = await extractTextFromPdfFile(f);
      setRawText(text);
    } catch (e) {
      setParseError(
        e instanceof Error
          ? e.message
          : "No se pudo leer el PDF. Probá otro archivo o usá CSV.",
      );
    } finally {
      setBusy(false);
    }
  }

  function applyImport() {
    if (!parsed || !parsed.ok) return;
    if (
      !confirm(
        `Se agregarán ${parsed.rows.length} movimientos. ¿Continuar?`,
      )
    ) {
      return;
    }
    importTransactions(
      parsed.rows.map((r) => ({
        type: r.type,
        amount: r.amount,
        currency: r.currency ?? importCurrency,
        category: r.type === "expense" ? catExpense : catIncome,
        date: r.date,
        paymentMethod: r.type === "expense" ? payExpense : payIncome,
        description: r.description,
        isPending: false,
      })),
    );
    setRawText("");
    alert(`Importados ${parsed.rows.length} movimientos.`);
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
      <h2 className="text-lg font-medium text-white">
        Importar PDF (Itaú y similares)
      </h2>
      <p className="mt-2 text-sm text-zinc-500">
        Se lee el texto del PDF en tu navegador (no sube el archivo a ningún
        servidor). Los extractos varían: si no aparecen movimientos, abrí el
        bloque de texto crudo abajo y, si hace falta, exportá{" "}
        <strong className="text-zinc-300">CSV</strong> desde el banco o pegá la
        tabla en la importación CSV.
      </p>

      <label className="mt-4 block text-sm text-zinc-400">
        PDF del estado de cuenta
        <input
          type="file"
          accept=".pdf,application/pdf"
          disabled={busy}
          className="mt-1 block w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-2 file:text-sm file:text-white disabled:opacity-50"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>
      {busy && (
        <p className="mt-2 text-sm text-zinc-500">Leyendo PDF…</p>
      )}
      {parseError && (
        <p className="mt-2 text-sm text-rose-300">{parseError}</p>
      )}

      {rawText && !busy && (
        <details className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
          <summary className="cursor-pointer text-sm text-zinc-400">
            Texto extraído (por si querés copiarlo o revisar)
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-zinc-500">
            {rawText.slice(0, 12000)}
            {rawText.length > 12000 ? "\n…" : ""}
          </pre>
        </details>
      )}

      {parsed && !parsed.ok && (
        <p className="mt-4 rounded-lg border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
          {parsed.error}
        </p>
      )}

      {parsed && parsed.ok && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-zinc-400">
            Detectados:{" "}
            <strong className="text-white">{parsed.rows.length}</strong>{" "}
            movimientos
            {parsed.skipped > 0 && (
              <span className="text-zinc-600">
                {" "}
                ({parsed.skipped} líneas sin usar)
              </span>
            )}
            .
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-400">Moneda por defecto (fila sin detección)</span>
              <select
                value={importCurrency}
                onChange={(e) => setImportCurrency(e.target.value as CurrencyCode)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              >
                <option value="UYU">UYU ($)</option>
                <option value="USD">USD (US$)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-400">Categoría egresos</span>
              <select
                value={catExpense}
                onChange={(e) => setCatExpense(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              >
                {expenseCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-400">Categoría ingresos</span>
              <input
                value={catIncome}
                onChange={(e) => setCatIncome(e.target.value)}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-zinc-400">Medio — egresos</span>
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
              <span className="text-zinc-400">Medio — ingresos</span>
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
                {previewRows.slice(0, 25).map((r: CsvImportPreviewRow) => (
                  <tr key={`${r.line}-${r.date}-${r.amount}`}>
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
                    <td className="px-2 py-1.5 text-xs text-zinc-500">
                      {r.currency ?? importCurrency}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {fmtPreview(r.amount, r.currency ?? importCurrency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {previewRows.length > 25 && (
            <p className="text-xs text-zinc-600">
              Mostrando 25 de {previewRows.length}…
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
