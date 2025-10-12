import React from 'react';
import { 
  calculateProgramFinancials, 
  calculateProjectedMargin,
  type FinancialCalculationParams 
} from '@/lib/utils/financial-calculations';

/**
 * Derive program price and margin using shared calculation utility
 * For Active programs, uses locked price for margin calculation
 * Program Price = Projected Price + |Variance|
 */
export function useFinancialsDerived(options: {
  totalCharge: number;
  totalCost: number;
  financeCharges: number;
  discounts: number;
  taxes?: number;
  totalTaxableCharge?: number;
  isActive?: boolean;
  lockedPrice?: number;
  variance?: number;
}) {
  const { 
    totalCharge, 
    totalCost, 
    financeCharges, 
    discounts, 
    taxes = 0, 
    totalTaxableCharge = 0,
    isActive = false,
    lockedPrice = 0,
    variance = 0
  } = options;
  
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
      
      // For Active programs, recalculate margin using locked price
      let finalMargin = result.margin;
      if (isActive && lockedPrice > 0) {
        finalMargin = calculateProjectedMargin(
          lockedPrice,
          Number(totalCost || 0),
          Number(financeCharges || 0),
          result.taxes
        );
      }
      
      // Calculate Program Price based on program status
      const varianceValue = Number(variance || 0);
      let programPrice: number;
      
      if (isActive && lockedPrice > 0) {
        // For Active programs: Program Price = Locked Price (always)
        // The variance tracks the difference between projected and locked
        programPrice = lockedPrice;
        
        // Validation: Variance should NEVER be positive (would mean over-delivering)
        if (varianceValue > 0.01) {
          console.error('⚠️ CRITICAL: Positive variance detected!', {
            variance: varianceValue,
            projectedPrice: result.programPrice,
            lockedPrice: lockedPrice,
          });
        }
        
        // Validation: Projected price should not exceed locked price
        if (result.programPrice > lockedPrice + 0.01) {
          console.error('⚠️ CRITICAL: Projected price exceeds locked price!', {
            projectedPrice: result.programPrice,
            lockedPrice: lockedPrice,
            difference: result.programPrice - lockedPrice,
          });
        }
      } else {
        // For Quote programs: Program Price = Projected Price + |Variance|
        // This accounts for any variance from previous Active status
        programPrice = result.programPrice + Math.abs(varianceValue);
      }
      
      return {
        programPrice: programPrice,
        margin: finalMargin,
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
  }, [totalCharge, totalCost, financeCharges, discounts, taxes, totalTaxableCharge, isActive, lockedPrice, variance]);
}
