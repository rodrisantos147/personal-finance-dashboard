"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { buildDemoSnapshot } from "./demo-data";
import { resolveDefaultCurrency } from "./format";
import {
  dedupeTransactionsByKey,
  transactionDedupeKey,
} from "./transaction-dedupe";
import type {
  AppSettings,
  CreditCard,
  CurrencyCode,
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
  /**
   * Alta masiva (import CSV / PDF). Omite filas ya iguales a las guardadas
   * (misma fecha, monto, tipo, descripción, etc.).
   */
  importTransactions: (
    items: Omit<Transaction, "id">[],
  ) => { added: number; skippedDuplicates: number };
  /** Elimina movimientos duplicados ya guardados (una pasada por clave). */
  dedupeTransactions: () => { removed: number };
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
    defaultCurrency: "UYU",
    locale: "es-UY",
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
        set((s) => {
          const dc = resolveDefaultCurrency(s.settings);
          const k = transactionDedupeKey(t, dc);
          if (s.transactions.some((x) => transactionDedupeKey(x, dc) === k)) {
            return s;
          }
          return {
            transactions: [
              ...s.transactions,
              { ...t, id: uid() },
            ].sort((a, b) => b.date.localeCompare(a.date)),
          };
        }),

      importTransactions: (items) => {
        const s = get();
        const dc = resolveDefaultCurrency(s.settings);
        const keys = new Set(
          s.transactions.map((x) => transactionDedupeKey(x, dc)),
        );
        const fresh: Transaction[] = [];
        let skippedDuplicates = 0;
        for (const t of items) {
          const k = transactionDedupeKey(t, dc);
          if (keys.has(k)) {
            skippedDuplicates++;
            continue;
          }
          keys.add(k);
          fresh.push({ ...t, id: uid() });
        }
        set({
          transactions: [...fresh, ...s.transactions].sort((a, b) =>
            b.date.localeCompare(a.date),
          ),
        });
        return { added: fresh.length, skippedDuplicates };
      },

      dedupeTransactions: () => {
        const s = get();
        const before = s.transactions.length;
        const next = dedupeTransactionsByKey(s.transactions, s.settings);
        set({ transactions: next });
        return { removed: before - next.length };
      },

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
        const rawSettings = data.settings as
          | (Partial<AppSettings> & { currency?: string })
          | undefined;
        const mergedSettings: AppSettings = {
          ...defaultState.settings,
          ...rawSettings,
          defaultCurrency:
            rawSettings?.defaultCurrency ??
            (rawSettings?.currency as CurrencyCode | undefined) ??
            "UYU",
          locale: rawSettings?.locale ?? defaultState.settings.locale,
        };
        const dc = mergedSettings.defaultCurrency;
        const rawTx = (data.transactions ?? []).map((t) => ({
          ...t,
          currency: t.currency ?? dc,
        }));
        set({
          settings: mergedSettings,
          transactions: dedupeTransactionsByKey(rawTx, mergedSettings),
          creditCards: data.creditCards ?? [],
          wishlist: (data.wishlist ?? []).map((w) => ({
            ...w,
            currency: w.currency ?? dc,
          })),
          recurringIncomes: (data.recurringIncomes ?? []).map((r) => ({
            ...r,
            currency: r.currency ?? dc,
          })),
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
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<FinanceState>;
        const c = current as FinanceState;
        const merged = { ...c, ...p };
        merged.settings = {
          ...defaultState.settings,
          ...c.settings,
          ...p.settings,
          defaultCurrency:
            p.settings?.defaultCurrency ??
            c.settings?.defaultCurrency ??
            defaultState.settings.defaultCurrency,
          locale: p.settings?.locale ?? c.settings.locale,
        };
        const txs = merged.transactions ?? [];
        merged.transactions =
          txs.length > 0
            ? dedupeTransactionsByKey(txs, merged.settings)
            : txs;
        return merged;
      },
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
