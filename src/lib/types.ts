export type PaymentMethod = "debit" | "credit" | "cash" | "transfer";

export type TransactionType = "income" | "expense";

/** ISO 4217 — UYU pesos uruguayos, USD dólares US. */
export type CurrencyCode = "UYU" | "USD" | "ARS" | "EUR";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  /** Moneda del importe (pesos vs dólares, etc.). Si falta, usa el default de ajustes. */
  currency?: CurrencyCode;
  category: string;
  date: string;
  paymentMethod: PaymentMethod;
  cardId?: string;
  description: string;
  /** Cobro/pago aún no liquidado o ingreso esperado */
  isPending: boolean;
  /**
   * Si es true, no suma en ingresos/gastos ni resultado del período en el resumen
   * (pago de tarjeta desde cuenta, traspasos entre cuentas propias). Sigue en la lista de movimientos.
   */
  omitFromPeriodSummary?: boolean;
}

/** Un mes concreto cuando el banco no usa el mismo día todos los meses. */
export interface CreditCardMonthEntry {
  year: number;
  /** 1–12 */
  month: number;
  closingDay: number;
  dueDay: number;
}

export interface CreditCard {
  id: string;
  name: string;
  /** Día de cierre del resumen (1–31) — usado si no hay `annualSchedule` o fuera del calendario */
  closingDay: number;
  /** Día de vencimiento de pago (1–31) */
  dueDay: number;
  /** Límite de compras en pesos uruguayos (opcional; para ver % usado). */
  creditLimitUyu?: number;
  /** Opcional: cierre/vencimiento por mes (ej. tabla anual del home banking). */
  annualSchedule?: CreditCardMonthEntry[];
}

export type WishlistPriority = "low" | "medium" | "high";

export interface WishlistItem {
  id: string;
  name: string;
  estimate: number;
  priority: WishlistPriority;
  notes: string;
  createdAt: string;
  currency?: CurrencyCode;
}

export interface RecurringIncome {
  id: string;
  label: string;
  amount: number;
  dayOfMonth: number;
  active: boolean;
  currency?: CurrencyCode;
}

export interface AppSettings {
  /** Moneda por defecto al cargar movimientos nuevos e importaciones. */
  defaultCurrency: CurrencyCode;
  locale: string;
  /** Saldo inicial antes del primer movimiento registrado */
  initialBalance: number;
  /**
   * Pesos uruguayos por 1 USD — combina UYU + USD en el informe (KPI, histórico,
   * comparación vs período anterior) cuando la moneda del informe es UYU o USD.
   */
  referenceUyuPerUsd?: number;
  /**
   * Si es true (por defecto), los movimientos guardados como ARS se tratan como UYU
   * en totales, Consumos y tablas. Útil cuando el import marcó mal “pesos” como ARS.
   * Desactivá solo si usás pesos argentinos reales.
   */
  treatArsAsUyu?: boolean;
  /** @deprecated usar defaultCurrency */
  currency?: string;
}
