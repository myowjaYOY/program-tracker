import React from 'react';

/**
 * Derive program price and margin with business rules:
 *  - Program Price = totalCharge + max(0, financeCharges) + discounts + taxes
 *  - If financeCharges < 0, treat absolute value as a financing fee (cost only)
 *  - Margin = (Program Price - (totalCost + financingFee)) / Program Price
 */
export function useFinancialsDerived(options: {
  totalCharge: number;
  totalCost: number;
  financeCharges: number;
  discounts: number;
  taxes?: number;
  totalTaxableCharge?: number; // Add this to calculate proportional taxes
}) {
  const { totalCharge, totalCost, financeCharges, discounts, taxes = 0, totalTaxableCharge = 0 } = options;
  return React.useMemo(() => {
    const positiveFinance = Math.max(0, Number(financeCharges || 0));
    const negativeFinanceFee = Math.max(0, -Number(financeCharges || 0));
    
    // Calculate proportional discount for taxable items (same logic as backend)
    let calculatedTaxes = 0;
    if (totalCharge > 0 && totalTaxableCharge > 0) {
      // Calculate what percentage of the total charge is taxable
      const taxablePercentage = totalTaxableCharge / totalCharge;
      // Apply that percentage of the discount to taxable items
      const taxableDiscount = Math.abs(discounts) * taxablePercentage;
      // Calculate taxes on the discounted taxable amount
      const discountedTaxableCharge = totalTaxableCharge - taxableDiscount;
      calculatedTaxes = discountedTaxableCharge * 0.0825;
    } else {
      // Fallback to passed-in taxes if no taxable charge data
      calculatedTaxes = Number(taxes || 0);
    }
    
    const programPrice =
      Number(totalCharge || 0) + positiveFinance + Number(discounts || 0) + calculatedTaxes;
    const revenue = programPrice;
    const costs = Number(totalCost || 0) + negativeFinanceFee + calculatedTaxes;
    const margin = revenue > 0 ? ((revenue - costs) / revenue) * 100 : 0;
    
    // Round to proper precision
    const roundedProgramPrice = Math.round(programPrice * 100) / 100;
    const roundedMargin = Math.round(margin * 100) / 100;
    const roundedTaxes = Math.round(calculatedTaxes * 100) / 100;
    
    return { programPrice: roundedProgramPrice, margin: roundedMargin, taxes: roundedTaxes };
  }, [totalCharge, totalCost, financeCharges, discounts, taxes, totalTaxableCharge]);
}
