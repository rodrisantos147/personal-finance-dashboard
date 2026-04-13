"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { buildDemoSnapshot } from "./demo-data";
import type {
  AppSettings,
  CreditCard,
  RecurringIncome,
  Transaction,
  WishlistItem,
} from "./types";

const DEFAULT_CATEGORIES = [
  "Comida",
  "Transporte",
  "Servicios",
  "Entretenimiento",
  "Salud",
  "Hogar",
  "Ropa",
  "Otros",
];

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface FinanceState {
  settings: AppSettings;
  transactions: Transaction[];
  creditCards: CreditCard[];
  wishlist: WishlistItem[];
  recurringIncomes: RecurringIncome[];
  expenseCategories: string[];

  setSettings: (s: Partial<AppSettings>) => void;
  addTransaction: (t: Omit<Transaction, "id">) => void;
  /** Alta masiva (import CSV); preserva movimientos ya cargados. */
  importTransactions: (items: Omit<Transaction, "id">[]) => void;
  updateTransaction: (id: string, t: Partial<Transaction>) => void;
  removeTransaction: (id: string) => void;

  addCreditCard: (c: Omit<CreditCard, "id">) => void;
  updateCreditCard: (id: string, c: Partial<CreditCard>) => void;
  removeCreditCard: (id: string) => void;

  addWishlist: (w: Omit<WishlistItem, "id" | "createdAt">) => void;
  updateWishlist: (id: string, w: Partial<WishlistItem>) => void;
  removeWishlist: (id: string) => void;

  addRecurringIncome: (r: Omit<RecurringIncome, "id">) => void;
  updateRecurringIncome: (id: string, r: Partial<RecurringIncome>) => void;
  removeRecurringIncome: (id: string) => void;

  addExpenseCategory: (name: string) => void;
  exportData: () => string;
  importData: (json: string) => void;
  /** Reemplaza todo el estado por el dataset demo (ventas, onboarding, capturas). */
  loadDemoData: () => void;
  resetAll: () => void;
}

const defaultState = {
  settings: {
    currency: "ARS",
    locale: "es-AR",
    initialBalance: 0,
  } satisfies AppSettings,
  transactions: [] as Transaction[],
  creditCards: [] as CreditCard[],
  wishlist: [] as WishlistItem[],
  recurringIncomes: [] as RecurringIncome[],
  expenseCategories: [...DEFAULT_CATEGORIES],
};

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      ...defaultState,

      setSettings: (partial) =>
        set((s) => ({ settings: { ...s.settings, ...partial } })),

      addTransaction: (t) =>
        set((s) => ({
          transactions: [
            ...s.transactions,
            { ...t, id: uid() },
          ].sort((a, b) => b.date.localeCompare(a.date)),
        })),

      importTransactions: (items) =>
        set((s) => ({
          transactions: [
            ...items.map((t) => ({ ...t, id: uid() })),
            ...s.transactions,
          ].sort((a, b) => b.date.localeCompare(a.date)),
        })),

      updateTransaction: (id, partial) =>
        set((s) => ({
          transactions: s.transactions
            .map((x) => (x.id === id ? { ...x, ...partial } : x))
            .sort((a, b) => b.date.localeCompare(a.date)),
        })),

      removeTransaction: (id) =>
        set((s) => ({
          transactions: s.transactions.filter((x) => x.id !== id),
        })),

      addCreditCard: (c) =>
        set((s) => ({
          creditCards: [...s.creditCards, { ...c, id: uid() }],
        })),

      updateCreditCard: (id, partial) =>
        set((s) => ({
          creditCards: s.creditCards.map((x) =>
            x.id === id ? { ...x, ...partial } : x,
          ),
        })),

      removeCreditCard: (id) =>
        set((s) => ({
          creditCards: s.creditCards.filter((x) => x.id !== id),
          transactions: s.transactions.map((t) =>
            t.cardId === id ? { ...t, cardId: undefined } : t,
          ),
        })),

      addWishlist: (w) =>
        set((s) => ({
          wishlist: [
            ...s.wishlist,
            {
              ...w,
              id: uid(),
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      updateWishlist: (id, partial) =>
        set((s) => ({
          wishlist: s.wishlist.map((x) =>
            x.id === id ? { ...x, ...partial } : x,
          ),
        })),

      removeWishlist: (id) =>
        set((s) => ({
          wishlist: s.wishlist.filter((x) => x.id !== id),
        })),

      addRecurringIncome: (r) =>
        set((s) => ({
          recurringIncomes: [...s.recurringIncomes, { ...r, id: uid() }],
        })),

      updateRecurringIncome: (id, partial) =>
        set((s) => ({
          recurringIncomes: s.recurringIncomes.map((x) =>
            x.id === id ? { ...x, ...partial } : x,
          ),
        })),

      removeRecurringIncome: (id) =>
        set((s) => ({
          recurringIncomes: s.recurringIncomes.filter((x) => x.id !== id),
        })),

      addExpenseCategory: (name) => {
        const n = name.trim();
        if (!n) return;
        set((s) => {
          if (s.expenseCategories.includes(n)) return s;
          return { expenseCategories: [...s.expenseCategories, n] };
        });
      },

      exportData: () => {
        const { settings, transactions, creditCards, wishlist, recurringIncomes, expenseCategories } =
          get();
        return JSON.stringify(
          {
            version: 1,
            exportedAt: new Date().toISOString(),
            settings,
            transactions,
            creditCards,
            wishlist,
            recurringIncomes,
            expenseCategories,
          },
          null,
          2,
        );
      },

      importData: (json) => {
        const data = JSON.parse(json) as Partial<typeof defaultState> & {
          version?: number;
        };
        set({
          settings: { ...defaultState.settings, ...data.settings },
          transactions: data.transactions ?? [],
          creditCards: data.creditCards ?? [],
          wishlist: data.wishlist ?? [],
          recurringIncomes: data.recurringIncomes ?? [],
          expenseCategories:
            data.expenseCategories?.length ? data.expenseCategories : DEFAULT_CATEGORIES,
        });
      },

      loadDemoData: () => {
        get().importData(JSON.stringify(buildDemoSnapshot()));
      },

      resetAll: () => set({ ...defaultState }),
    }),
    {
      name: "personal-finance-dashboard",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        settings: s.settings,
        transactions: s.transactions,
        creditCards: s.creditCards,
        wishlist: s.wishlist,
        recurringIncomes: s.recurringIncomes,
        expenseCategories: s.expenseCategories,
      }),
    },
  ),
);
