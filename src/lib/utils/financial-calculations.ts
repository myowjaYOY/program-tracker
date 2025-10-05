/**
 * Shared utility functions for financial calculations
 * Single source of truth for all program financial calculations
 */

export interface FinancialCalculationParams {
  totalCost: number;
  totalCharge: number;
  financeCharges: number;
  discounts: number;
  totalTaxableCharge: number;
}

export interface FinancialCalculationResult {
  programPrice: number;
  margin: number;
  taxes: number;
  totalCost: number;
  totalCharge: number;
}

/**
 * Round to cents (2 decimal places)
 */
export function roundToCents(value: number): number {
  return Math.round(Number(value || 0) * 100) / 100;
}

/**
 * Round to percentage (1 decimal place)
 */
export function roundToPercentage(value: number): number {
  return Math.round(Number(value || 0) * 10) / 10;
}

/**
 * Validate financial input parameters
 */
export function validateFinancialInputs(params: FinancialCalculationParams): void {
  if (params.totalCost < 0) {
    throw new Error('Total cost cannot be negative');
  }
  if (params.totalCharge < 0) {
    throw new Error('Total charge cannot be negative');
  }
  if (params.totalTaxableCharge < 0) {
    throw new Error('Total taxable charge cannot be negative');
  }
  if (params.totalTaxableCharge > params.totalCharge) {
    throw new Error('Total taxable charge cannot exceed total charge');
  }
}

/**
 * Calculate program financials with business rules:
 * - Program Price = totalCharge + max(0, financeCharges) + discounts + taxes
 * - If financeCharges < 0, treat absolute value as a financing fee (cost only)
 * - Margin = (Program Price - (totalCost + financingFee)) / Program Price
 * - Taxes = 8.25% of taxable charges after proportional discount application
 */
export function calculateProgramFinancials(
  params: FinancialCalculationParams
): FinancialCalculationResult {
  // Validate inputs
  validateFinancialInputs(params);

  const {
    totalCost,
    totalCharge,
    financeCharges,
    discounts,
    totalTaxableCharge,
  } = params;

  // Handle finance charges: positive = revenue, negative = cost
  const positiveFinance = Math.max(0, Number(financeCharges || 0));
  const negativeFinanceFee = Math.max(0, -Number(financeCharges || 0));

  // Calculate proportional discount for taxable items
  let calculatedTaxes = 0;
  if (totalCharge > 0 && totalTaxableCharge > 0) {
    // Calculate what percentage of the total charge is taxable
    const taxablePercentage = totalTaxableCharge / totalCharge;
    // Apply that percentage of the discount to taxable items
    const taxableDiscount = Math.abs(discounts) * taxablePercentage;
    // Calculate taxes on the discounted taxable amount
    const discountedTaxableCharge = totalTaxableCharge - taxableDiscount;
    calculatedTaxes = discountedTaxableCharge * 0.0825;
  }

  // Calculate program price: totalCharge + finance_charges + discounts + taxes
  const programPrice =
    Number(totalCharge || 0) +
    positiveFinance +
    Number(discounts || 0) +
    calculatedTaxes;

  // Calculate margin: (Program Price - (totalCost + financingFee + taxes)) / Program Price
  const costs = Number(totalCost || 0) + negativeFinanceFee + calculatedTaxes;
  const margin = programPrice > 0 ? ((programPrice - costs) / programPrice) * 100 : 0;

  // Round to proper precision
  const roundedProgramPrice = roundToCents(programPrice);
  const roundedMargin = roundToCents(margin);
  const roundedTaxes = roundToCents(calculatedTaxes);

  return {
    programPrice: roundedProgramPrice,
    margin: roundedMargin,
    taxes: roundedTaxes,
    totalCost: roundToCents(totalCost),
    totalCharge: roundToCents(totalCharge),
  };
}

/**
 * Calculate simple template totals (for program templates without complex financials)
 */
export function calculateTemplateTotals(
  items: Array<{ item_cost: number | null; item_charge: number | null; quantity: number | null }>
): {
  totalCost: number;
  totalCharge: number;
  marginPercentage: number;
} {
  const totalCost = items.reduce((sum, item) => {
    return sum + (item.item_cost ?? 0) * (item.quantity ?? 0);
  }, 0);

  const totalCharge = items.reduce((sum, item) => {
    return sum + (item.item_charge ?? 0) * (item.quantity ?? 0);
  }, 0);

  // Calculate margin percentage: ((total_charge - total_cost) / total_charge) * 100
  const marginPercentage =
    totalCharge > 0 ? ((totalCharge - totalCost) / totalCharge) * 100 : 0;

  return {
    totalCost: roundToCents(totalCost),
    totalCharge: roundToCents(totalCharge),
    marginPercentage: roundToPercentage(marginPercentage),
  };
}
