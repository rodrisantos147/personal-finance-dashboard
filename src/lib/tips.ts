import { daysUntil, nextClosingDate, nextDueDate } from "./finance";
import type { CreditCard } from "./types";

export function buildTips(input: {
  periodIncome: number;
  periodExpense: number;
  creditExpenseShare: number;
  pendingIncome: number;
  pendingExpense: number;
  futureIncomeEstimate: number;
  cards: CreditCard[];
}): string[] {
  const tips: string[] = [];

  if (input.periodExpense > input.periodIncome && input.periodIncome > 0) {
    tips.push(
      "En este período los gastos superaron los ingresos registrados. Revisá suscripciones y gastos hormiga.",
    );
  }

  if (input.creditExpenseShare > 0.45 && input.periodExpense > 0) {
    tips.push(
      "Una parte alta del gasto fue con tarjeta de crédito. Acordate del cierre y del pago total para evitar intereses.",
    );
  }

  if (input.pendingExpense > input.pendingIncome) {
    tips.push(
      "Tenés más egresos pendientes que ingresos pendientes. Priorizá liquidar lo urgente antes de nuevos gastos discrecionales.",
    );
  }

  if (input.futureIncomeEstimate > 0) {
    tips.push(
      `Ingresos futuros estimados en el horizonte: ${input.futureIncomeEstimate.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}. Usalos solo como referencia hasta que entren.`,
    );
  }

  const now = new Date();
  for (const c of input.cards) {
    const close = nextClosingDate(c, now);
    const due = nextDueDate(c, now);
    const dc = daysUntil(close, now);
    const dd = daysUntil(due, now);
    if (dc <= 7 && dc >= 0) {
      tips.push(
        `Cierre próximo de "${c.name}" en ${dc} día(s). Los consumos de crédito de este ciclo entran en el resumen que cierra ese día.`,
      );
    }
    if (dd <= 7 && dd >= 0) {
      tips.push(
        `Vencimiento de "${c.name}" en ${dd} día(s). Verificá que el débito automático o la transferencia esté programada.`,
      );
    }
  }

  if (tips.length === 0) {
    tips.push(
      "Seguí registrando movimientos para obtener comparativas y alertas más precisas.",
    );
  }

  return tips;
}
