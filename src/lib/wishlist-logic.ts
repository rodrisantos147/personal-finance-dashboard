import type { WishlistItem } from "./types";

export type BuyVerdict = "ideal" | "ok" | "wait";

export function evaluateWishlistItem(
  item: WishlistItem,
  surplusAfterBills: number,
): { verdict: BuyVerdict; detail: string } {
  const buffer = item.estimate * 0.1;
  const need = item.estimate + buffer;

  if (surplusAfterBills >= need) {
    return {
      verdict: "ideal",
      detail:
        "Tu superávit proyectado cubre el gasto con un margen del ~10%. Buen momento si no hay prioridades mayores.",
    };
  }

  if (surplusAfterBills >= item.estimate * 0.85) {
    return {
      verdict: "ok",
      detail:
        "Podrías comprarlo si ajustás algo este mes o posponés otro gasto menor. Evaluá el impacto en el cierre de tarjeta.",
    };
  }

  return {
    verdict: "wait",
    detail:
      "Conviene esperar: el superávit no alcanza cómodamente. Sumá ingreso extra o reducí gastos antes de comprar.",
  };
}

export function priorityWeight(p: WishlistItem["priority"]) {
  if (p === "high") return 3;
  if (p === "medium") return 2;
  return 1;
}
