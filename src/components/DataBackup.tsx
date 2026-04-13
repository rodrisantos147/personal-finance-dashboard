"use client";

import { useState } from "react";
import { CsvImport } from "@/components/CsvImport";
import { PdfImport } from "@/components/PdfImport";
import { buildDemoExportJson } from "@/lib/demo-data";
import { useFinanceStore } from "@/lib/store";

export function DataBackup() {
  const settings = useFinanceStore((s) => s.settings);
  const setSettings = useFinanceStore((s) => s.setSettings);
  const exportData = useFinanceStore((s) => s.exportData);
  const importData = useFinanceStore((s) => s.importData);
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

      <CsvImport />

      <PdfImport />

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="text-lg font-medium text-white">Saldo inicial</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Opcional: usalo si querés proyectar acumulado desde antes del primer
          registro (próxima versión puede usarlo en reportes).
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
          className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const label = String(fd.get("label") || "").trim();
            const amount = Number(fd.get("amount"));
            const day = Number(fd.get("day"));
            if (!label || !Number.isFinite(amount) || amount <= 0) return;
            if (!Number.isFinite(day) || day < 1 || day > 31) return;
            addRecurringIncome({
              label,
              amount,
              dayOfMonth: day,
              active: true,
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
                  — día {r.dayOfMonth} — {r.amount.toLocaleString("es-AR", {
                    style: "currency",
                    currency: settings.currency,
                  })}
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
