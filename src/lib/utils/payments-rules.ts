/**
 * Decide if payments should be regenerated given prior and next finance values.
 * This encapsulates the conservative rule currently used on the Financials screen.
 */
export function shouldRegeneratePayments(options: {
  paymentsExist: boolean;
  originalFinancingTypeId?: number | null;
  nextFinancingTypeId?: number | null;
  originalFinanceCharges: number;
  nextFinanceCharges: number;
  originalDiscounts: number;
  nextDiscounts: number;
}): boolean {
  const {
    paymentsExist,
    originalFinancingTypeId,
    nextFinancingTypeId,
    originalFinanceCharges,
    nextFinanceCharges,
    originalDiscounts,
    nextDiscounts,
  } = options;

  const finTypeChanged = (originalFinancingTypeId ?? null) !== (nextFinancingTypeId ?? null);
  const financeChargesChanged = roundToCents(originalFinanceCharges) !== roundToCents(nextFinanceCharges);
  const discountsChanged = roundToCents(originalDiscounts) !== roundToCents(nextDiscounts);

  return !paymentsExist || finTypeChanged || financeChargesChanged || discountsChanged;
}

function roundToCents(n: number): number {
  return Math.round((Number(n || 0)) * 100);
}


