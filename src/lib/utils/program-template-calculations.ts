import { ProgramTemplateItems } from '@/types/database.types';
import { calculateTemplateTotals } from './financial-calculations';

export interface ProgramTemplateTotals {
  total_cost: number;
  total_charge: number;
  margin_percentage: number;
}

/**
 * Calculate totals for a program template based on its items
 * Uses shared calculation utility for consistency
 */
export function calculateProgramTemplateTotals(
  items: ProgramTemplateItems[]
): ProgramTemplateTotals {
  const result = calculateTemplateTotals(items);

  return {
    total_cost: result.totalCost,
    total_charge: result.totalCharge,
    margin_percentage: result.marginPercentage,
  };
}
