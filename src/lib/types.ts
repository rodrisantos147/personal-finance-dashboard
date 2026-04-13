export type PaymentMethod = "debit" | "credit" | "cash" | "transfer";

export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  date: string;
  paymentMethod: PaymentMethod;
  cardId?: string;
  description: string;
  /** Cobro/pago aún no liquidado o ingreso esperado */
  isPending: boolean;
}

export interface CreditCard {
  id: string;
  name: string;
  /** Día de cierre del resumen (1–31) */
  closingDay: number;
  /** Día de vencimiento de pago (1–31) */
  dueDay: number;
}

export type WishlistPriority = "low" | "medium" | "high";

export interface WishlistItem {
  id: string;
  name: string;
  estimate: number;
  priority: WishlistPriority;
  notes: string;
  createdAt: string;
}

export interface RecurringIncome {
  id: string;
  label: string;
  amount: number;
  dayOfMonth: number;
  active: boolean;
}

export interface AppSettings {
  currency: string;
  locale: string;
  /** Saldo inicial antes del primer movimiento registrado */
  initialBalance: number;
}
