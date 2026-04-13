"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { buildDemoSnapshot } from "./demo-data";
import {
  normalizeStoredCurrency,
  resolveDefaultCurrency,
} from "./format";
import {
  inferOmitFromPeriodSummary,
  shouldReclassifyIncomeAsCardExpense,
} from "./finance";
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

/** Quita opciones viejas y normaliza moneda por defecto (UYU / USD / EUR). */
function scrubSettings(settings: AppSettings): AppSettings {
  const out = { ...settings };
  delete (out as Record<string, unknown>).treatArsAsUyu;
  out.defaultCurrency = normalizeStoredCurrency(
    String(out.defaultCurrency ?? "UYU"),
    "UYU",
  );
  return out;
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
  /**
   * Marca como &quot;fuera del resumen&quot; ingresos que parecen pago de tarjeta
   * (misma heurística que el import CSV/PDF).
   */
  reapplyIncomeOmitHeuristic: () => { updated: number };
  /**
   * Pasa a gasto con medio tarjeta los ingresos que parecen compras TC (DLO*, PedidosYa, etc.).
   */
  reclassifyCardPurchasesMislabeledAsIncome: () => { updated: number };
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
        set((s) => ({
          settings: scrubSettings({ ...s.settings, ...partial }),
        })),

      addTransaction: (t) =>
        set((s) => {
          const dc = resolveDefaultCurrency(s.settings);
          const normalized: Omit<Transaction, "id"> = {
            ...t,
            currency: normalizeStoredCurrency(
              t.currency as string | undefined,
              dc,
            ),
          };
          const k = transactionDedupeKey(normalized, dc);
          if (s.transactions.some((x) => transactionDedupeKey(x, dc) === k)) {
            return s;
          }
          return {
            transactions: [
              ...s.transactions,
              { ...normalized, id: uid() },
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
          const normalized: Omit<Transaction, "id"> = {
            ...t,
            currency: normalizeStoredCurrency(
              t.currency as string | undefined,
              dc,
            ),
          };
          const k = transactionDedupeKey(normalized, dc);
          if (keys.has(k)) {
            skippedDuplicates++;
            continue;
          }
          keys.add(k);
          fresh.push({ ...normalized, id: uid() });
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

      reapplyIncomeOmitHeuristic: () => {
        let updated = 0;
        set((s) => ({
          transactions: s.transactions.map((t) => {
            if (
              inferOmitFromPeriodSummary(t.type, t.description) &&
              !t.omitFromPeriodSummary
            ) {
              updated++;
              return { ...t, omitFromPeriodSummary: true };
            }
            return t;
          }),
        }));
        return { updated };
      },

      reclassifyCardPurchasesMislabeledAsIncome: () => {
        let updated = 0;
        set((s) => ({
          transactions: s.transactions
            .map((t) => {
              if (!shouldReclassifyIncomeAsCardExpense(t)) return t;
              updated++;
              return {
                ...t,
                type: "expense" as const,
                paymentMethod: "credit" as const,
                category: t.category === "Ingreso" ? "Otros" : t.category,
              };
            })
            .sort((a, b) => b.date.localeCompare(a.date)),
        }));
        return { updated };
      },

      updateTransaction: (id, partial) =>
        set((s) => {
          const dc = resolveDefaultCurrency(s.settings);
          const norm =
            partial.currency !== undefined
              ? {
                  ...partial,
                  currency: normalizeStoredCurrency(
                    partial.currency as string,
                    dc,
                  ),
                }
              : partial;
          return {
            transactions: s.transactions
              .map((x) => (x.id === id ? { ...x, ...norm } : x))
              .sort((a, b) => b.date.localeCompare(a.date)),
          };
        }),

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
        set((s) => {
          const dc = resolveDefaultCurrency(s.settings);
          return {
            wishlist: [
              ...s.wishlist,
              {
                ...w,
                id: uid(),
                createdAt: new Date().toISOString(),
                currency: normalizeStoredCurrency(
                  w.currency as string | undefined,
                  dc,
                ),
              },
            ],
          };
        }),

      updateWishlist: (id, partial) =>
        set((s) => {
          const dc = resolveDefaultCurrency(s.settings);
          const norm =
            partial.currency !== undefined
              ? {
                  ...partial,
                  currency: normalizeStoredCurrency(
                    partial.currency as string,
                    dc,
                  ),
                }
              : partial;
          return {
            wishlist: s.wishlist.map((x) =>
              x.id === id ? { ...x, ...norm } : x,
            ),
          };
        }),

      removeWishlist: (id) =>
        set((s) => ({
          wishlist: s.wishlist.filter((x) => x.id !== id),
        })),

      addRecurringIncome: (r) =>
        set((s) => {
          const dc = resolveDefaultCurrency(s.settings);
          return {
            recurringIncomes: [
              ...s.recurringIncomes,
              {
                ...r,
                id: uid(),
                currency: normalizeStoredCurrency(
                  r.currency as string | undefined,
                  dc,
                ),
              },
            ],
          };
        }),

      updateRecurringIncome: (id, partial) =>
        set((s) => {
          const dc = resolveDefaultCurrency(s.settings);
          const norm =
            partial.currency !== undefined
              ? {
                  ...partial,
                  currency: normalizeStoredCurrency(
                    partial.currency as string,
                    dc,
                  ),
                }
              : partial;
          return {
            recurringIncomes: s.recurringIncomes.map((x) =>
              x.id === id ? { ...x, ...norm } : x,
            ),
          };
        }),

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
        const mergedSettings = scrubSettings({
          ...defaultState.settings,
          ...rawSettings,
          defaultCurrency: normalizeStoredCurrency(
            rawSettings?.defaultCurrency ??
              (rawSettings?.currency as string | undefined) ??
              "UYU",
            "UYU",
          ),
          locale: rawSettings?.locale ?? defaultState.settings.locale,
        });
        const dc = mergedSettings.defaultCurrency;
        const rawTx = (data.transactions ?? []).map((t) => ({
          ...t,
          currency: normalizeStoredCurrency(
            t.currency as string | undefined,
            dc,
          ),
        }));
        set({
          settings: mergedSettings,
          transactions: dedupeTransactionsByKey(rawTx, mergedSettings),
          creditCards: data.creditCards ?? [],
          wishlist: (data.wishlist ?? []).map((w) => ({
            ...w,
            currency: normalizeStoredCurrency(
              w.currency as string | undefined,
              dc,
            ),
          })),
          recurringIncomes: (data.recurringIncomes ?? []).map((r) => ({
            ...r,
            currency: normalizeStoredCurrency(
              r.currency as string | undefined,
              dc,
            ),
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
        const merged = { ...c, ...p } as FinanceState;
        merged.settings = scrubSettings({
          ...defaultState.settings,
          ...c.settings,
          ...p.settings,
          defaultCurrency: normalizeStoredCurrency(
            String(
              merged.settings.defaultCurrency ??
                defaultState.settings.defaultCurrency,
            ),
            "UYU",
          ),
          locale: p.settings?.locale ?? c.settings.locale,
        });
        const dc = merged.settings.defaultCurrency;
        merged.transactions = dedupeTransactionsByKey(
          (merged.transactions ?? []).map((t) => ({
            ...t,
            currency: normalizeStoredCurrency(
              t.currency as string | undefined,
              dc,
            ),
          })),
          merged.settings,
        );
        merged.wishlist = (merged.wishlist ?? []).map((w) => ({
          ...w,
          currency: normalizeStoredCurrency(
            w.currency as string | undefined,
            dc,
          ),
        }));
        merged.recurringIncomes = (merged.recurringIncomes ?? []).map(
          (r) => ({
            ...r,
            currency: normalizeStoredCurrency(
              r.currency as string | undefined,
              dc,
            ),
          }),
        );
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
