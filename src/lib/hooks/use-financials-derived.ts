import React from 'react';
import { calculateProgramFinancials, type FinancialCalculationParams } from '@/lib/utils/financial-calculations';

/**
 * Derive program price and margin using shared calculation utility
 */
export function useFinancialsDerived(options: {
  totalCharge: number;
  totalCost: number;
  financeCharges: number;
  discounts: number;
  taxes?: number;
  totalTaxableCharge?: number;
}) {
  const { totalCharge, totalCost, financeCharges, discounts, taxes = 0, totalTaxableCharge = 0 } = options;
  
  return React.useMemo(() => {
    try {
      const params: FinancialCalculationParams = {
        totalCost: Number(totalCost || 0),
        totalCharge: Number(totalCharge || 0),
        financeCharges: Number(financeCharges || 0),
        discounts: Number(discounts || 0),
        totalTaxableCharge: Number(totalTaxableCharge || 0),
      };

      const result = calculateProgramFinancials(params);
      
      return {
        programPrice: result.programPrice,
        margin: result.margin,
        taxes: result.taxes,
      };
    } catch (error) {
      // Fallback to passed-in taxes if calculation fails
      console.warn('Financial calculation error, using fallback:', error);
      return {
        programPrice: Number(totalCharge || 0) + Number(financeCharges || 0) + Number(discounts || 0) + Number(taxes || 0),
        margin: 0,
        taxes: Number(taxes || 0),
      };
    }
  }, [totalCharge, totalCost, financeCharges, discounts, taxes, totalTaxableCharge]);
}
