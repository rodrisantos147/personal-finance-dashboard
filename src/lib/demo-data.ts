import {
  addDays,
  endOfMonth,
  setDate,
  startOfMonth,
  subMonths,
} from "date-fns";
import type {
  AppSettings,
  CreditCard,
  PaymentMethod,
  RecurringIncome,
  Transaction,
  TransactionType,
  WishlistItem,
} from "./types";

/** Misma forma que `exportData()` para poder reutilizar `importData`. */
export type DemoSnapshot = {
  version: 1;
  exportedAt: string;
  settings: AppSettings;
  transactions: Transaction[];
  creditCards: CreditCard[];
  wishlist: WishlistItem[];
  recurringIncomes: RecurringIncome[];
  expenseCategories: string[];
};

type TxSeed = {
  monthOffset: number;
  day: number;
  type: TransactionType;
  amount: number;
  category: string;
  paymentMethod: PaymentMethod;
  cardId?: string;
  description: string;
  isPending: boolean;
};

const CARD_VISA = "demo-card-visa";
const CARD_MC = "demo-card-master";

/**
 * Dataset demo reproducible: los montos son fijos; las fechas se anclan al mes
 * actual respecto de `referenceDate` (por defecto hoy), así las gráficas y el
 * período "mes actual" siempre se ven bien en demos y capturas.
 */
export function buildDemoSnapshot(referenceDate: Date = new Date()): DemoSnapshot {
  const exportedAt = referenceDate.toISOString();
  const seeds: TxSeed[] = [];

  // Últimos 6 meses (0 = mes corriente)
  for (let m = 0; m < 6; m++) {
    const base = subMonths(startOfMonth(referenceDate), m);
    const push = (day: number, partial: Omit<TxSeed, "monthOffset" | "day">) => {
      seeds.push({ monthOffset: m, day, ...partial });
    };

    // Ingresos
    push(5, {
      type: "income",
      amount: 920_000 + m * 12_000,
      category: "Ingreso",
      paymentMethod: "transfer",
      description: "Sueldo — Acme S.A.",
      isPending: false,
    });
    if (m % 2 === 0) {
      push(18, {
        type: "income",
        amount: 95_000,
        category: "Ingreso",
        paymentMethod: "transfer",
        description: "Factura freelance (diseño)",
        isPending: false,
      });
    }

    // Gastos variados (montos demo creíbles en ARS)
    push(2, {
      type: "expense",
      amount: 28_000 + m * 800,
      category: "Comida",
      paymentMethod: "debit",
      description: "Supermercado",
      isPending: false,
    });
    push(4, {
      type: "expense",
      amount: 14_500,
      category: "Transporte",
      paymentMethod: "credit",
      cardId: CARD_VISA,
      description: "Nafta / estacionamiento",
      isPending: false,
    });
    push(7, {
      type: "expense",
      amount: 42_000 + m * 2_000,
      category: "Servicios",
      paymentMethod: "debit",
      description: "Luz + gas + internet",
      isPending: false,
    });
    push(9, {
      type: "expense",
      amount: 12_900,
      category: "Entretenimiento",
      paymentMethod: "credit",
      cardId: CARD_MC,
      description: "Streaming + juegos",
      isPending: false,
    });
    push(11, {
      type: "expense",
      amount: 8_400,
      category: "Comida",
      paymentMethod: "cash",
      description: "Delivery",
      isPending: false,
    });
    push(14, {
      type: "expense",
      amount: 67_000,
      category: "Salud",
      paymentMethod: "credit",
      cardId: CARD_VISA,
      description: "Prepaga / medicamentos",
      isPending: false,
    });
    push(20, {
      type: "expense",
      amount: 22_000,
      category: "Hogar",
      paymentMethod: "debit",
      description: "Limpieza / mantenimiento",
      isPending: false,
    });
    push(22, {
      type: "expense",
      amount: 35_000 + (m % 3) * 5_000,
      category: "Ropa",
      paymentMethod: "credit",
      cardId: CARD_MC,
      description: "Indumentaria",
      isPending: false,
    });
    push(26, {
      type: "expense",
      amount: 19_500,
      category: "Transporte",
      paymentMethod: "transfer",
      description: "Viajes / subte",
      isPending: false,
    });

    if (m === 0) {
      push(28, {
        type: "expense",
        amount: 125_000,
        category: "Otros",
        paymentMethod: "credit",
        cardId: CARD_VISA,
        description: "Electro en cuotas (1/6)",
        isPending: true,
      });
      push(30, {
        type: "income",
        amount: 48_000,
        category: "Ingreso",
        paymentMethod: "transfer",
        description: "Reintegro esperado",
        isPending: true,
      });
    }
  }

  const transactions: Transaction[] = seeds.map((s, i) => {
    const monthStart = subMonths(startOfMonth(referenceDate), s.monthOffset);
    const lastDay = endOfMonth(monthStart).getDate();
    const d = setDate(monthStart, Math.min(s.day, lastDay));
    return {
      id: `demo-tx-${String(i + 1).padStart(3, "0")}`,
      type: s.type,
      amount: s.amount,
      category: s.category,
      date: d.toISOString(),
      paymentMethod: s.paymentMethod,
      cardId: s.cardId,
      description: s.description,
      isPending: s.isPending,
    };
  });

  transactions.sort((a, b) => b.date.localeCompare(a.date));

  const creditCards: CreditCard[] = [
    { id: CARD_VISA, name: "Visa Crédito (demo)", closingDay: 12, dueDay: 20 },
    { id: CARD_MC, name: "Mastercard (demo)", closingDay: 25, dueDay: 5 },
  ];

  const recurringIncomes: RecurringIncome[] = [
    {
      id: "demo-rec-sueldo",
      label: "Sueldo neto",
      amount: 920_000,
      dayOfMonth: 5,
      active: true,
    },
    {
      id: "demo-rec-extras",
      label: "Extras (media)",
      amount: 45_000,
      dayOfMonth: 15,
      active: true,
    },
  ];

  const wishlist: WishlistItem[] = [
    {
      id: "demo-wish-1",
      name: "Auriculares ANC",
      estimate: 189_000,
      priority: "high",
      notes: "Comparar en hot sale",
      createdAt: addDays(referenceDate, -12).toISOString(),
    },
    {
      id: "demo-wish-2",
      name: "Escritorio elevable",
      estimate: 420_000,
      priority: "medium",
      notes: "",
      createdAt: addDays(referenceDate, -40).toISOString(),
    },
    {
      id: "demo-wish-3",
      name: "Curso online",
      estimate: 75_000,
      priority: "low",
      notes: "Cuando baje el dólar",
      createdAt: addDays(referenceDate, -5).toISOString(),
    },
  ];

  const expenseCategories = [
    "Comida",
    "Transporte",
    "Servicios",
    "Entretenimiento",
    "Salud",
    "Hogar",
    "Ropa",
    "Subscripciones",
    "Educación",
    "Otros",
  ];

  const settings: AppSettings = {
    currency: "ARS",
    locale: "es-AR",
    initialBalance: 180_000,
  };

  return {
    version: 1,
    exportedAt,
    settings,
    transactions,
    creditCards,
    wishlist,
    recurringIncomes,
    expenseCategories,
  };
}

/** JSON estable para QA o para pegar en import manual (misma forma que export). */
export function buildDemoExportJson(referenceDate?: Date): string {
  const snap = buildDemoSnapshot(referenceDate);
  return JSON.stringify(snap, null, 2);
}
