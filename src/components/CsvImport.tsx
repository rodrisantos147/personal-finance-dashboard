"use client";

import { useEffect, useMemo, useState } from "react";
import { formatMoneyWithSettings, resolveDefaultCurrency } from "@/lib/format";
import {
  parseBankCsv,
  type CsvImportPreviewRow,
  type SingleAmountConvention,
} from "@/lib/csv-import";
import { inferOmitFromPeriodSummary } from "@/lib/finance";
import { useFinanceStore } from "@/lib/store";
import type { CurrencyCode, PaymentMethod } from "@/lib/types";

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "debit", label: "Débito" },
  { id: "credit", label: "Crédito" },
  { id: "cash", label: "Efectivo" },
  { id: "transfer", label: "Transferencia" },
];

export function CsvImport() {
  const settings = useFinanceStore((s) => s.settings);
  const expenseCategories = useFinanceStore((s) => s.expenseCategories);
  const importTransactions = useFinanceStore((s) => s.importTransactions);

  const [text, setText] = useState("");
  const [convention, setConvention] =
    useState<SingleAmountConvention>("signed");
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

  const parsed = useMemo(() => {
    if (!text.trim()) return null;
    return parseBankCsv(text, convention, importCurrency);
  }, [text, convention, importCurrency]);

  const previewRows = useMemo(() => {
    if (!parsed || !parsed.ok) return [];
    return parsed.rows;
  }, [parsed]);

  function fmtPreview(n: number, c: CurrencyCode) {
    return formatMoneyWithSettings(n, settings, c);
  }

  function applyImport() {
    if (!parsed || !parsed.ok) return;
    const rows = parsed.rows;
    if (
      !confirm(
        `Se agregarán ${rows.length} movimientos a los que ya tenés. ¿Continuar?`,
      )
    ) {
      return;
    }
    const { added, skippedDuplicates } = importTransactions(
      rows.map((r) => ({
        type: r.type,
        amount: r.amount,
        currency: r.currency ?? importCurrency,
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
    setText("");
    alert(
      skippedDuplicates
        ? `Importados ${added} movimientos. Omitidos ${skippedDuplicates} duplicados (ya estaban cargados).`
        : `Importados ${added} movimientos.`,
    );
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
      <h2 className="text-lg font-medium text-white">
        Importar desde CSV (estados de cuenta / Excel)
      </h2>
      <p className="mt-2 text-sm text-zinc-500">
        Exportá el movimiento de tu banco a CSV o Excel y guardalo como{" "}
        <strong className="text-zinc-300">.csv</strong> (en Excel: Guardar
        como → CSV separado por comas o por punto y coma). Podés juntar varios
        meses en un solo archivo. La app detecta columnas típicas:{" "}
        <em>Fecha</em>, <em>Descripción</em>, <em>Débito</em> /{" "}
        <em>Crédito</em>, o una sola columna <em>Monto</em> /{" "}
        <em>Importe</em>.
      </p>

      <div className="mt-4 rounded-lg border border-dashed border-zinc-600 bg-zinc-950/50 p-4 text-xs text-zinc-500">
        <p className="font-medium text-zinc-400">Formato manual (una columna monto)</p>
        <pre className="mt-2 overflow-x-auto font-mono text-zinc-500">
{`Fecha,Descripción,Monto
15/01/2025,Supermercado,-45000
20/01/2025,Sueldo,850000`}
        </pre>
        <p className="mt-2">
          Con <strong className="text-zinc-400">monto con signo</strong>: negativo
          = egreso, positivo = ingreso (elegí abajo &quot;Signo del monto&quot;).
        </p>
      </div>

      <label className="mt-4 block text-sm text-zinc-400">
        Archivo .csv
        <input
          type="file"
          accept=".csv,text/csv,.txt"
          className="mt-1 block w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-2 file:text-sm file:text-white"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = () => setText(String(r.result ?? ""));
            r.readAsText(f, "UTF-8");
          }}
        />
      </label>

      <label className="mt-4 block text-sm text-zinc-400">
        O pegá el contenido del CSV
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Pegá aquí las filas…"
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-200"
        />
      </label>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">Moneda por defecto (si el CSV no la indica)</span>
          <select
            value={importCurrency}
            onChange={(e) => setImportCurrency(e.target.value as CurrencyCode)}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
          >
            <option value="UYU">UYU ($)</option>
            <option value="USD">USD (US$)</option>
            <option value="EUR">EUR (€)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">
            Si hay una sola columna de monto (sin Débito/Crédito)
          </span>
          <select
            value={convention}
            onChange={(e) =>
              setConvention(e.target.value as SingleAmountConvention)
            }
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
          >
            <option value="signed">
              Signo: negativo = egreso, positivo = ingreso
            </option>
            <option value="always_expense">Todo es egreso (solo gastos)</option>
            <option value="always_income">Todo es ingreso (solo ingresos)</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-zinc-400">Categoría egresos</span>
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
            <span className="text-zinc-400">Categoría ingresos</span>
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
          <span className="text-zinc-400">Medio de pago — egresos</span>
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
          <span className="text-zinc-400">Medio de pago — ingresos</span>
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

      {parsed && !parsed.ok && (
        <p className="mt-4 rounded-lg border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
          {parsed.error}
        </p>
      )}

      {parsed && parsed.ok && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-zinc-400">
            Listos para importar:{" "}
            <strong className="text-white">{parsed.rows.length}</strong>{" "}
            movimientos
            {parsed.skipped > 0 && (
              <>
                {" "}
                ({parsed.skipped} filas omitidas: vacías o sin fecha válida)
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
                {previewRows.slice(0, 25).map((r: CsvImportPreviewRow) => (
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
                      {r.currency ?? importCurrency}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-zinc-200">
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
