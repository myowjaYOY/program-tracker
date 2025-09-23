import React from 'react';

/**
 * Derive program price and margin with business rules:
 *  - Program Price = totalCharge + max(0, financeCharges) + discounts
 *  - If financeCharges < 0, treat absolute value as a financing fee (cost only)
 *  - Margin = (Program Price - (totalCost + financingFee)) / Program Price
 */
export function useFinancialsDerived(options: {
  totalCharge: number;
  totalCost: number;
  financeCharges: number;
  discounts: number;
}) {
  const { totalCharge, totalCost, financeCharges, discounts } = options;
  return React.useMemo(() => {
    const positiveFinance = Math.max(0, Number(financeCharges || 0));
    const negativeFinanceFee = Math.max(0, -Number(financeCharges || 0));
    const programPrice =
      Number(totalCharge || 0) + positiveFinance + Number(discounts || 0);
    const revenue = programPrice;
    const costs = Number(totalCost || 0) + negativeFinanceFee;
    const margin = revenue > 0 ? ((revenue - costs) / revenue) * 100 : 0;
    return { programPrice, margin };
  }, [totalCharge, totalCost, financeCharges, discounts]);
}
