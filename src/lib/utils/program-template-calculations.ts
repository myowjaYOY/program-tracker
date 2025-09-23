import { ProgramTemplateItems } from '@/types/database.types';

export interface ProgramTemplateTotals {
  total_cost: number;
  total_charge: number;
  margin_percentage: number;
}

/**
 * Calculate totals for a program template based on its items
 */
export function calculateProgramTemplateTotals(
  items: ProgramTemplateItems[]
): ProgramTemplateTotals {
  const total_cost = items.reduce((sum, item) => {
    return sum + item.cost * item.quantity;
  }, 0);

  const total_charge = items.reduce((sum, item) => {
    return sum + item.charge * item.quantity;
  }, 0);

  // Calculate margin percentage: ((total_charge - total_cost) / total_charge) * 100
  const margin_percentage =
    total_charge > 0 ? ((total_charge - total_cost) / total_charge) * 100 : 0;

  return {
    total_cost: Math.round(total_cost * 100) / 100, // Round to 2 decimal places
    total_charge: Math.round(total_charge * 100) / 100, // Round to 2 decimal places
    margin_percentage: Math.round(margin_percentage * 10) / 10, // Round to 1 decimal place
  };
}
