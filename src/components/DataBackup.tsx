"use client";

import { useState } from "react";
import { CsvImport } from "@/components/CsvImport";
import { PdfImport } from "@/components/PdfImport";
import { april2026Card8002Movements } from "@/lib/card-import-april-2026-8002";
import { buildDemoExportJson } from "@/lib/demo-data";
import {
  formatMoneyWithSettings,
  normalizeStoredCurrency,
  resolveDefaultCurrency,
} from "@/lib/format";
import { useFinanceStore } from "@/lib/store";
import type { CurrencyCode } from "@/lib/types";

export function DataBackup() {
  const settings = useFinanceStore((s) => s.settings);
  const setSettings = useFinanceStore((s) => s.setSettings);
  const exportData = useFinanceStore((s) => s.exportData);
  const importData = useFinanceStore((s) => s.importData);
  const importTransactions = useFinanceStore((s) => s.importTransactions);
  const dedupeTransactions = useFinanceStore((s) => s.dedupeTransactions);
  const reapplyIncomeOmitHeuristic = useFinanceStore(
    (s) => s.reapplyIncomeOmitHeuristic,
  );
  const reclassifyCardPurchasesMislabeledAsIncome = useFinanceStore(
    (s) => s.reclassifyCardPurchasesMislabeledAsIncome,
  );
  const fixSaaSUsdSubscriptions = useFinanceStore(
    (s) => s.fixSaaSUsdSubscriptions,
  );
  const transactionCount = useFinanceStore((s) => s.transactions.length);
  const loadDemoData = useFinanceStore((s) => s.loadDemoData);
  const resetAll = useFinanceStore((s) => s.resetAll);
  const addRecurringIncome = useFinanceStore((s) => s.addRecurringIncome);
  const recurringIncomes = useFinanceStore((s) => s.recurringIncomes);
  const updateRecurringIncome = useFinanceStore((s) => s.updateRecurringIncome);
  const removeRecurringIncome = useFinanceStore((s) => s.removeRecurringIncome);

  const [importText, setImportText] = useState("");

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-white/15 bg-zinc-900/60 p-6">
        <h2 className="text-lg font-medium text-white">Dataset demo (ventas / onboarding)</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Carga ficticia reproducible: ~6 meses de movimientos, dos tarjetas,
          ingresos recurrentes, lista de deseos y pendientes. Las fechas se
          generan respecto de <strong className="text-zinc-200">hoy</strong>, así
          las gráficas y el &quot;mes actual&quot; se ven bien en cualquier
          momento. Podés también descargar el mismo contenido como JSON (mismo
          formato que un respaldo) para compartirlo o versionarlo en el repo.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
            onClick={() => {
              if (
                confirm(
                  "Se reemplazarán todos los datos locales por el dataset demo. ¿Continuar?",
                )
              ) {
                loadDemoData();
              }
            }}
          >
            Cargar dataset demo
          </button>
          <button
            type="button"
            className="rounded-lg border border-zinc-600 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800"
            onClick={() => {
              const blob = new Blob([buildDemoExportJson()], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `finanzas-demo-seed-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Solo descargar JSON demo
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-6">
        <h2 className="text-lg font-medium text-white">
          Extracto TC ****8002 — abril 2026
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          Carga los 15 movimientos del resumen que importaste (PedidosYa, Spotify, Claude,
          UTE, SODIMAC, pago de tarjeta, cuotas, etc.). Se suman a lo que ya tengas en
          este navegador; no borra datos.
        </p>
        <button
          type="button"
          className="mt-4 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
          onClick={() => {
            if (
              confirm(
                `Agregar ${april2026Card8002Movements.length} movimientos de abril 2026 al historial actual?`,
              )
            ) {
              const { added, skippedDuplicates } = importTransactions(
                april2026Card8002Movements,
              );
              alert(
                skippedDuplicates
                  ? `Agregados ${added}. ${skippedDuplicates} ya estaban (duplicados omitidos).`
                  : `Agregados ${added} movimientos. Revisá Resumen o Movimientos.`,
              );
            }
          }}
        >
          Agregar movimientos TC 8002 (abr 2026)
        </button>
      </section>

      <CsvImport />

      <PdfImport />

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="text-lg font-medium text-white">Duplicados en movimientos</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Si importaste el mismo extracto dos veces, podés dejar una sola fila por
          movimiento (misma fecha, monto, tipo, descripción, moneda, categoría y
          medio). También se omiten duplicados al importar CSV/PDF y al cargar la
          app.
        </p>
        <p className="mt-2 text-xs text-zinc-600">
          Movimientos guardados: {transactionCount}
        </p>
        <button
          type="button"
          className="mt-4 rounded-lg border border-zinc-600 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800"
          onClick={() => {
            const { removed } = dedupeTransactions();
            alert(
              removed
                ? `Se eliminaron ${removed} movimientos duplicados.`
                : "No había duplicados con la misma clave.",
            );
          }}
        >
          Quitar duplicados ahora
        </button>
        <button
          type="button"
          className="ml-3 mt-4 rounded-lg border border-zinc-600 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800"
          onClick={() => {
            const { updated } = reapplyIncomeOmitHeuristic();
            alert(
              updated
                ? `Se marcaron ${updated} ingresos como "fuera del resumen" (suelen ser pagos de tarjeta). Revisá Resumen.`
                : "No se encontraron ingresos nuevos que califiquen. Si un pago de TC sigue sumando, marcálo a mano en Movimientos.",
            );
          }}
        >
          Detectar pagos de tarjeta en ingresos
        </button>
        <button
          type="button"
          className="ml-3 mt-4 rounded-lg border border-amber-800/60 px-4 py-2.5 text-sm text-amber-100/90 hover:bg-amber-950/40"
          onClick={() => {
            const { updated } = reclassifyCardPurchasesMislabeledAsIncome();
            alert(
              updated
                ? `Se pasaron ${updated} movimientos de ingreso a gasto con tarjeta (compras mal clasificadas). Revisá Resumen y Movimientos.`
                : "No había ingresos que coincidan con el patrón (ej. DLO*, PedidosYa). Si falta alguno, corregilo a mano.",
            );
          }}
        >
          Corregir compras TC cargadas como ingreso
        </button>
        <button
          type="button"
          className="ml-3 mt-4 rounded-lg border border-sky-800/60 px-4 py-2.5 text-sm text-sky-100/90 hover:bg-sky-950/35"
          onClick={() => {
            const { updated } = fixSaaSUsdSubscriptions();
            alert(
              updated
                ? `Se actualizaron ${updated} movimientos (OpenAI, Cursor, Spotify, etc.): moneda USD, gasto con TC si estaban como ingreso, y vuelven al resumen del período cuando correspondía.`
                : "No había filas que califiquen. Si el banco usa otro texto en el detalle, cambiá moneda y tipo a mano en Movimientos.",
            );
          }}
        >
          Suscripciones USD (OpenAI, Cursor…)
        </button>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="text-lg font-medium text-white">Ajustes generales</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Moneda por defecto para movimientos nuevos, importaciones y la vista de
          reportes cuando elegís una sola moneda.
        </p>
        <label className="mt-4 flex max-w-sm flex-col gap-1 text-sm">
          <span className="text-zinc-400">Moneda por defecto</span>
          <select
            value={resolveDefaultCurrency(settings)}
            onChange={(e) =>
              setSettings({ defaultCurrency: e.target.value as CurrencyCode })
            }
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
          >
            <option value="UYU">UYU — pesos uruguayos</option>
            <option value="USD">USD — dólares estadounidenses</option>
          </select>
        </label>
        <label className="mt-4 flex max-w-sm flex-col gap-1 text-sm">
          <span className="text-zinc-400">
            Tipo de cambio referencia (pesos por 1 USD)
          </span>
          <input
            type="number"
            min={0}
            step={0.01}
            placeholder="Ej. 42"
            value={
              settings.referenceUyuPerUsd != null &&
              settings.referenceUyuPerUsd > 0
                ? settings.referenceUyuPerUsd
                : ""
            }
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || v === "0") {
                setSettings({ referenceUyuPerUsd: undefined });
                return;
              }
              const n = Number(v);
              setSettings({
                referenceUyuPerUsd: Number.isFinite(n) && n > 0 ? n : undefined,
              });
            }}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
          />
          <span className="text-xs text-zinc-600">
            Opcional. Mezcla UYU y USD en KPI, histórico y comparación con el período
            anterior cuando el informe está en pesos o dólares.
          </span>
        </label>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="text-lg font-medium text-white">Saldo inicial</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Opcional: usalo si querés proyectar acumulado desde antes del primer
          registro (próxima versión puede usarlo en reportes). El monto se interpreta
          en la moneda por defecto.
        </p>
        <label className="mt-4 flex max-w-sm flex-col gap-1 text-sm">
          <span className="text-zinc-400">Monto</span>
          <input
            type="number"
            value={settings.initialBalance}
            onChange={(e) =>
              setSettings({ initialBalance: Number(e.target.value) || 0 })
            }
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
          />
        </label>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="text-lg font-medium text-white">Ingresos recurrentes</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Sueldo u otros ingresos fijos por día del mes. Se usan para estimar
          ingresos futuros del mes.
        </p>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const label = String(fd.get("label") || "").trim();
            const amount = Number(fd.get("amount"));
            const day = Number(fd.get("day"));
            const cur = String(fd.get("currency") || "UYU") as CurrencyCode;
            if (!label || !Number.isFinite(amount) || amount <= 0) return;
            if (!Number.isFinite(day) || day < 1 || day > 31) return;
            addRecurringIncome({
              label,
              amount,
              dayOfMonth: day,
              active: true,
              currency: normalizeStoredCurrency(cur, "UYU"),
            });
            e.currentTarget.reset();
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Concepto</span>
            <input
              name="label"
              required
              placeholder="Sueldo"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Monto</span>
            <input
              name="amount"
              type="number"
              required
              min={0}
              step="0.01"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Día del mes</span>
            <input
              name="day"
              type="number"
              min={1}
              max={31}
              required
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">Moneda</span>
            <select
              name="currency"
              defaultValue={resolveDefaultCurrency(settings)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
            >
              <option value="UYU">UYU</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-white py-2.5 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
            >
              Añadir
            </button>
          </div>
        </form>
        <ul className="mt-4 space-y-2">
          {recurringIncomes.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm"
            >
              <span className="text-zinc-200">
                {r.label}{" "}
                <span className="text-zinc-500">
                  — día {r.dayOfMonth} —{" "}
                  {formatMoneyWithSettings(
                    r.amount,
                    settings,
                    r.currency ?? resolveDefaultCurrency(settings),
                  )}
                </span>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-xs text-zinc-500 hover:text-white"
                  onClick={() =>
                    updateRecurringIncome(r.id, { active: !r.active })
                  }
                >
                  {r.active ? "Pausar" : "Activar"}
                </button>
                <button
                  type="button"
                  className="text-xs text-rose-400 hover:text-rose-300"
                  onClick={() => removeRecurringIncome(r.id)}
                >
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="text-lg font-medium text-white">Exportar / importar</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Descargá un JSON con todo. Guardalo en un lugar seguro. Importar
          reemplaza los datos locales actuales.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
            onClick={() => {
              const blob = new Blob([exportData()], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `finanzas-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Descargar respaldo
          </button>
          <button
            type="button"
            className="rounded-lg border border-rose-900/60 px-4 py-2 text-sm text-rose-400 hover:bg-rose-950/30"
            onClick={() => {
              if (
                confirm(
                  "¿Borrar todos los datos locales? Esta acción no se puede deshacer.",
                )
              )
                resetAll();
            }}
          >
            Reiniciar app
          </button>
        </div>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="Pegá aquí un JSON exportado previamente…"
          rows={8}
          className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-300"
        />
        <button
          type="button"
          className="mt-2 rounded-lg border border-zinc-600 px-4 py-2 text-sm text-white hover:bg-zinc-800"
          onClick={() => {
            try {
              importData(importText);
              setImportText("");
              alert("Importación correcta.");
            } catch {
              alert("JSON inválido.");
            }
          }}
        >
          Importar y reemplazar
        </button>
      </section>
    </div>
  );
}
