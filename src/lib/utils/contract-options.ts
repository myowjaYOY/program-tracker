export interface ContractOptionsInput {
  programPrice: number; // total displayed (includes taxes)
  taxes: number; // total taxes
  taxablePreTax: number; // sum of taxable charges before tax
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
  const programPrice = Number(input.programPrice || 0);
  const taxes = Number(input.taxes || 0);
  const taxablePreTax = Number(input.taxablePreTax || 0);

  const preTax = Math.max(0, programPrice - taxes);
  const taxRate = taxablePreTax > 0 ? taxes / taxablePreTax : 0;

  // 5% discount on pre-tax (recompute taxes only on taxable portion)
  const discountedPreTax = preTax * 0.95;
  const discountedTaxable = Math.max(0, taxablePreTax * 0.95);
  const discountedTaxes = discountedTaxable * taxRate;
  const discountedProgramPrice = discountedPreTax + discountedTaxes;

  // Financing scenario: add 6% of pre-tax to current program price
  const financeFullAmount = programPrice + preTax * 0.06;
  const financeDownPayment = financeFullAmount * 0.25; // 25%
  const financeMonthlyPayment = (financeFullAmount - financeDownPayment) / 5; // 5 months

  // Three equal payments based on current program price
  const threeEqualPayments = programPrice / 3;

  return {
    discountedPreTax5Amount: round2(preTax * 0.05),
    discountedProgramPrice5: round2(discountedProgramPrice),
    financeFullAmount: round2(financeFullAmount),
    financeDownPayment: round2(financeDownPayment),
    financeMonthlyPayment: round2(financeMonthlyPayment),
    threeEqualPayments: round2(threeEqualPayments),
  };
}





