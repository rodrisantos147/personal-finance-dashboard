export type FinancialStateVariant = "positive" | "balanced" | "caution" | "negative";

export type FinancialStateSummary = {
  /** Etiqueta corta (badge) */
  label: string;
  /** Título principal */
  title: string;
  /** Párrafo guía */
  description: string;
  /** Detalles puntuales */
  bullets: string[];
  variant: FinancialStateVariant;
};

export function summarizeFinancialState(input: {
  net: number;
  income: number;
  expense: number;
  projectedSurplus: number;
  pendingIncome: number;
  pendingExpense: number;
  deltaIncomePct: number;
  deltaExpensePct: number;
  creditExpenseShare: number;
  referenceNetUyu: number | null;
  hasReferenceFx: boolean;
  movementsInPeriod: number;
}): FinancialStateSummary {
  const {
    net,
    income,
    expense,
    projectedSurplus,
    pendingIncome,
    pendingExpense,
    deltaIncomePct,
    deltaExpensePct,
    creditExpenseShare,
    referenceNetUyu,
    hasReferenceFx,
    movementsInPeriod,
  } = input;

  if (movementsInPeriod === 0) {
    return {
      label: "Sin datos del período",
      title: "Todavía no registraste movimientos en estas fechas",
      description:
        "Cuando cargues ingresos y gastos del período seleccionado, aquí verás un resumen de cómo venís.",
      bullets: [
        "Podés usar Movimientos para alta manual o importar CSV/PDF desde Datos.",
      ],
      variant: "balanced",
    };
  }

  const pendingNet = pendingIncome - pendingExpense;
  const bullets: string[] = [];

  if (income > 0 || expense > 0) {
    if (deltaIncomePct !== 0 || deltaExpensePct !== 0) {
      const parts: string[] = [];
      if (Math.abs(deltaIncomePct) >= 0.1) {
        const s = deltaIncomePct >= 0 ? "+" : "";
        parts.push(
          `Ingresos vs período anterior: ${s}${deltaIncomePct.toFixed(1)}%`,
        );
      }
      if (Math.abs(deltaExpensePct) >= 0.1) {
        const s = deltaExpensePct >= 0 ? "+" : "";
        parts.push(
          `Gastos vs período anterior: ${s}${deltaExpensePct.toFixed(1)}%`,
        );
      }
      if (parts.length) bullets.push(parts.join(" · "));
    }
  }

  if (pendingIncome > 0 || pendingExpense > 0) {
    bullets.push(
      pendingNet >= 0
        ? "Pendientes: hay más por cobrar que por pagar entre lo marcado como pendiente."
        : "Pendientes: hay más egresos que ingresos aún no liquidados.",
    );
  }

  if (creditExpenseShare >= 0.35 && expense > 0) {
    bullets.push(
      `Cerca del ${Math.round(creditExpenseShare * 100)}% de los gastos del período fueron con tarjeta de crédito.`,
    );
  }

  if (hasReferenceFx && referenceNetUyu != null) {
    const sign = referenceNetUyu >= 0 ? "+" : "";
    bullets.push(
      `Referencia combinada (UYU+USD con tu TC): ${sign}${referenceNetUyu.toLocaleString("es-UY", { maximumFractionDigits: 0 })} UYU de resultado en el período.`,
    );
  }

  let variant: FinancialStateVariant;
  let label: string;
  let title: string;
  let description: string;

  const heavyDeficit = net < 0 && income > 0 && expense > income * 1.05;

  if (net < 0) {
    variant = heavyDeficit ? "negative" : "caution";
    label = "Déficit en el período";
    title = "Estás gastando más de lo que ingresó en este período";
    description =
      projectedSurplus < 0
        ? "Además, sumando pendientes y lo que falta del mes, la proyección también está roja. Conviene revisar gastos o ingresos esperados."
        : "Aun así, pendientes e ingresos futuros podrían compensar: mirá el superávit proyectado abajo.";
  } else if (net === 0) {
    variant = "balanced";
    label = "Equilibrio";
    title = "Ingresos y gastos del período se compensan";
    description =
      projectedSurplus >= 0
        ? "Con lo pendiente y lo que falta ingresar del mes, seguís con margen proyectado positivo."
        : "Ojo con lo que falta liquidar este mes: la proyección sugiere ajustar.";
  } else if (projectedSurplus < 0) {
    variant = "caution";
    label = "Superávit con tensión";
    title = "El período cerró bien, pero la proyección del mes aprieta";
    description =
      "En estas fechas los ingresos superan a los gastos, pero pendientes y lo que falta del mes pueden dejarte justo. Revisá tarjeta y vencimientos.";
  } else {
    variant = "positive";
    label = "En superávit";
    title = "Llevás ingresos por encima de los gastos en este período";
    description =
      "El resultado del período es favorable y la proyección del mes también se mantiene en positivo.";
  }

  if (bullets.length > 4) bullets.length = 4;

  return { label, title, description, bullets, variant };
}
