import { calculateTaxesOnTaxableItems, calculateProjectedPrice } from './financial-calculations';

export interface ContractOptionsInput {
  totalCharge: number; // base charge from items
  totalCost: number; // cost of items
  financeCharges: number; // finance charges
  discounts: number; // current discounts
  totalTaxableCharge: number; // taxable charge from items
}

export interface ContractOptionsResult {
  discountedPreTax5Amount: number;
  discountedProgramPrice5: number;
  financeFullAmount: number;
  financeDownPayment: number;
  financeMonthlyPayment: number;
  threeEqualPayments: number;
}

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function buildContractOptions(input: ContractOptionsInput): ContractOptionsResult {
  const totalCharge = Number(input.totalCharge || 0);
  const financeCharges = Number(input.financeCharges || 0);
  const discounts = Number(input.discounts || 0);
  const totalTaxableCharge = Number(input.totalTaxableCharge || 0);

  // Calculate current taxes using shared function
  const currentTaxes = calculateTaxesOnTaxableItems(totalCharge, totalTaxableCharge, discounts);
  
  // Calculate current program price using shared function
  const currentProgramPrice = calculateProjectedPrice(totalCharge, currentTaxes, financeCharges, discounts);
  
  const preTax = Math.max(0, currentProgramPrice - currentTaxes);

  // Calculate 5% discount amount and apply it to existing discounts
  const fivePercentDiscount = totalCharge * 0.05;
  const discountedDiscounts = discounts - fivePercentDiscount;
  
  // Calculate new taxes with the 5% discount using shared function
  const discountedTaxes = calculateTaxesOnTaxableItems(totalCharge, totalTaxableCharge, discountedDiscounts);
  
  // Calculate new program price with the 5% discount using shared function
  const discountedProgramPrice = calculateProjectedPrice(totalCharge, discountedTaxes, financeCharges, discountedDiscounts);

  // Financing scenario: add 6% of pre-tax to current program price
  const financeFullAmount = currentProgramPrice + preTax * 0.06;
  const financeDownPayment = financeFullAmount * 0.25; // 25%
  const financeMonthlyPayment = (financeFullAmount - financeDownPayment) / 5; // 5 months

  // Three equal payments based on current program price
  const threeEqualPayments = currentProgramPrice / 3;

  return {
    discountedPreTax5Amount: round2(fivePercentDiscount),
    discountedProgramPrice5: round2(discountedProgramPrice),
    financeFullAmount: round2(financeFullAmount),
    financeDownPayment: round2(financeDownPayment),
    financeMonthlyPayment: round2(financeMonthlyPayment),
    threeEqualPayments: round2(threeEqualPayments),
  };
}












