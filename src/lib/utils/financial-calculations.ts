// Financial calculation utilities for program management

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface ActiveProgramValidationParams {
  projectedPrice: number;
  projectedMargin: number;
  lockedPrice: number;
  contractedAtMargin: number;
}

/**
 * Calculate variance between projected and locked price
 * Negative variance = under-delivering (customer gets credit)
 * Positive variance = over-delivering (customer owes more)
 */
export function calculateVariance(projectedPrice: number, lockedPrice: number): number {
  return projectedPrice - lockedPrice;
}

/**
 * Calculate margin using locked price as denominator (for Active programs)
 * This ensures margin reflects profitability on the contracted amount
 */
export function calculateMarginOnLockedPrice(lockedPrice: number, totalCost: number): number {
  if (lockedPrice <= 0) return 0;
  return ((lockedPrice - totalCost) / lockedPrice) * 100;
}

/**
 * Validate Active program changes against contracted bounds
 * - Price ceiling: Cannot exceed contracted price (can under-deliver)
 * - Margin floor: Cannot reduce margin below contracted level
 */
export function validateActiveProgramChanges(params: ActiveProgramValidationParams): ValidationResult {
  const { projectedPrice, projectedMargin, lockedPrice, contractedAtMargin } = params;
  const errors: string[] = [];

  // Price ceiling validation (allow 0.01 tolerance for floating-point precision)
  if (projectedPrice > lockedPrice + 0.01) {
    errors.push(`Cannot exceed contracted price of $${lockedPrice.toFixed(2)}`);
  }

  // Margin floor validation (allow 0.01 tolerance for floating-point precision)
  if (projectedMargin < contractedAtMargin - 0.01) {
    errors.push(`Cannot reduce margin below contracted ${contractedAtMargin.toFixed(1)}%`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Calculate projected price from items, taxes, finance charges, and discounts
 * Business rule:
 * - Negative finance charges: External partner cost - does NOT affect customer price (only margin)
 * - Positive finance charges: Internal financing revenue - INCREASES customer payment
 * Formula: price = totalCharge + taxes + max(financeCharges, 0) + discounts
 */
export function calculateProjectedPrice(
  totalCharge: number,
  taxes: number,
  financeCharges: number,
  discounts: number
): number {
  // Business rule: Only positive finance charges affect customer price
  // - Negative finance charge: Partner cost, does NOT reduce customer payment (only affects margin)
  // - Positive finance charge: Your financing fee, increases customer payment
  return totalCharge + taxes + Math.max(Number(financeCharges || 0), 0) + discounts;
}

/**
 * Calculate projected margin from projected price and total cost
 * Excludes taxes (pass-through) and adjusts cost based on finance charges
 * 
 * @param projectedPrice - Full program price including taxes and finance charges
 * @param totalCost - Cost of items
 * @param financeCharges - Finance charges (positive = revenue offset to cost, negative = added expense)
 * @param taxes - Tax amount (pass-through, excluded from margin calculation)
 * @returns Margin percentage based on pre-tax revenue
 */
export function calculateProjectedMargin(
  projectedPrice: number, 
  totalCost: number,
  financeCharges: number = 0,
  taxes: number = 0
): number {
  // Remove taxes from revenue (they're pass-through)
  const preTaxRevenue = projectedPrice - taxes;
  
  if (preTaxRevenue <= 0) return 0;
  
  // Finance charges affect cost calculation:
  // - Negative: External partner cost (expense) - ADD to cost
  // - Positive: Internal financing revenue - SUBTRACT from cost
  const adjustedCost = financeCharges < 0 
    ? totalCost + Math.abs(financeCharges)  // Negative: add to cost (expense)
    : totalCost - financeCharges;            // Positive: subtract from cost (revenue)
  
  const margin = ((preTaxRevenue - adjustedCost) / preTaxRevenue) * 100;
  // Do not allow negative margins per business rule
  return Math.max(margin, 0);
}

/**
 * Calculate taxes on taxable items with proportional discount application
 */
export function calculateTaxesOnTaxableItems(
  totalCharge: number,
  totalTaxableCharge: number,
  discounts: number,
  taxRate: number = 0.0825
): number {
  if (totalCharge <= 0 || totalTaxableCharge <= 0) return 0;
  
  // Calculate what percentage of the total charge is taxable
  const taxablePercentage = totalTaxableCharge / totalCharge;
  
  // Apply that percentage of the discount to taxable items
  const taxableDiscount = Math.abs(discounts) * taxablePercentage;
  
  // Calculate taxes on the discounted taxable amount
  const discountedTaxableCharge = totalTaxableCharge - taxableDiscount;
  
  return discountedTaxableCharge * taxRate;
}

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
}

/**
 * Calculate program financials (used by existing hooks and API routes)
 * 
 * ⚠️ IMPORTANT: This calculates margin based on PROJECTED PRICE
 * - For Quote programs: This is correct (use projected price as denominator)
 * - For Active programs: Margin should be calculated on LOCKED PRICE instead
 * 
 * Active programs should NOT use this function's margin value directly.
 * Instead, use the margin calculation in validateAndUpdateActiveProgramFinances()
 * which correctly calculates margin on the locked/contracted price.
 * 
 * See updateMemberProgramCalculatedFields() which skips margin updates for Active programs
 * to prevent incorrect values from being saved to the database.
 */
export function calculateProgramFinancials(params: FinancialCalculationParams): FinancialCalculationResult {
  const { totalCost, totalCharge, financeCharges, discounts, totalTaxableCharge } = params;
  
  const taxes = calculateTaxesOnTaxableItems(totalCharge, totalTaxableCharge, discounts);
  const programPrice = calculateProjectedPrice(totalCharge, taxes, financeCharges, discounts);
  const margin = calculateProjectedMargin(programPrice, totalCost, financeCharges, taxes);
  
  return {
    programPrice,
    margin,
    taxes
  };
}

export interface TemplateTotalsResult {
  totalCost: number;
  totalCharge: number;
  marginPercentage: number;
}

/**
 * Calculate template totals (used by program template calculations)
 */
export function calculateTemplateTotals(items: any[]): TemplateTotalsResult {
  let totalCost = 0;
  let totalCharge = 0;
  
  items.forEach(item => {
    const quantity = item.quantity || 1;
    const cost = item.item_cost || 0;
    const charge = item.item_charge || 0;
    
    totalCost += cost * quantity;
    totalCharge += charge * quantity;
  });
  
  // Templates don't have taxes or finance charges, so pass 0 for both
  const margin = calculateProjectedMargin(totalCharge, totalCost, 0, 0);
  
  return {
    totalCost,
    totalCharge,
    marginPercentage: margin
  };
}

/**
 * Validate Active program item changes (add/update/delete) BEFORE making the change
 * Only applies to programs with contracted_at_margin set
 */
export async function validateActiveProgramItemAddition(
  supabase: any,
  memberProgramId: number,
  itemData: any
) {
  try {
    // Get program status
    const { data: program, error: programError } = await supabase
      .from('member_programs')
      .select('program_status_id, program_status(status_name)')
      .eq('member_program_id', memberProgramId)
      .single();

    if (programError || !program) return;

    const statusName = (program.program_status as any)?.status_name?.toLowerCase();
    if (statusName !== 'active') return; // Only validate Active programs

    // Get current finances with contracted_at_margin
    const { data: finances, error: financesError } = await supabase
      .from('member_program_finances')
      .select('final_total_price, contracted_at_margin, finance_charges, discounts')
      .eq('member_program_id', memberProgramId)
      .single();

    if (financesError || !finances || !finances.contracted_at_margin) return;

    // Get current items to calculate projected values
    const { data: items, error: itemsError } = await supabase
      .from('member_program_items')
      .select(`
        member_program_item_id,
        quantity,
        item_cost,
        item_charge,
        therapy_id,
        therapies(taxable)
      `)
      .eq('member_program_id', memberProgramId)
      .eq('active_flag', true);

    if (itemsError) return;

    // Determine operation type
    const operation = itemData.operation || 'add';
    const itemId = itemData.itemId;

    let updatedItems = [...(items || [])];

    if (operation === 'update') {
      // Simulate updating the item
      // CRITICAL: For Active programs, NEVER update item_cost or item_charge - only quantity and other fields
      // These prices are LOCKED when the program goes Active
      updatedItems = items.map((item: any) => {
        if (item.member_program_item_id === parseInt(itemId)) {
          const updatedItem = {
            ...item,
            quantity: itemData.quantity !== undefined ? itemData.quantity : item.quantity,
            // item_cost and item_charge are INTENTIONALLY NOT UPDATED - they're locked from member_program_items
          };
          return updatedItem;
        }
        return item;
      });
    } else if (operation === 'delete') {
      // Simulate deleting the item
      updatedItems = items.filter((item: any) => item.member_program_item_id !== parseInt(itemId));
    } else {
      // Simulate adding the new item
      const newItem = {
        member_program_item_id: -1, // Temporary ID for new items
        quantity: itemData.quantity || 1,
        item_cost: itemData.item_cost || 0,
        item_charge: itemData.item_charge || 0,
        therapy_id: itemData.therapy_id,
        therapies: { taxable: undefined } // Must be undefined so taxable lookup is triggered below
      };
      updatedItems.push(newItem);
    }

    // Calculate totals with the updated items
    let totalCost = 0;
    let totalCharge = 0;
    let totalTaxableCharge = 0;

    // Get therapy taxable status for all items that need it
    for (const item of updatedItems) {
      if (item.therapies?.taxable === undefined) {
        const { data: therapyData } = await supabase
          .from('therapies')
          .select('taxable')
          .eq('therapy_id', item.therapy_id)
          .single();
        item.therapies = { taxable: therapyData?.taxable || false };
      }

      const quantity = item.quantity || 1;
      const cost = item.item_cost || 0;
      const charge = item.item_charge || 0;
      const isTaxable = item.therapies?.taxable === true;

      totalCost += cost * quantity;
      totalCharge += charge * quantity;
      
      if (isTaxable) {
        totalTaxableCharge += charge * quantity;
      }
    }

    // Calculate projected values (after the change)
    const taxes = calculateTaxesOnTaxableItems(
      totalCharge,
      totalTaxableCharge,
      Number(finances.discounts || 0)
    );
    const projectedPrice = calculateProjectedPrice(
      totalCharge,
      taxes,
      Number(finances.finance_charges || 0),
      Number(finances.discounts || 0)
    );
    
    // Calculate margin on locked price using centralized function
    const lockedPrice = Number(finances.final_total_price || 0);
    const financeCharges = Number(finances.finance_charges || 0);
    const projectedMargin = calculateProjectedMargin(
      lockedPrice,
      totalCost,
      financeCharges,
      taxes
    );

    // Validate against bounds
    const validation = validateActiveProgramChanges({
      projectedPrice,
      projectedMargin,
      lockedPrice: lockedPrice,
      contractedAtMargin: Number(finances.contracted_at_margin || 0)
    });

    if (!validation.isValid) {
      // Provide a clearer error message for price ceiling violations on 'add' operation
      if (operation === 'add' && projectedPrice > lockedPrice + 0.01) {
        // Calculate item cost with tax efficiently (no extra loop)
        const newItemCharge = (itemData.item_charge || 0) * (itemData.quantity || 1);
        const newItem = updatedItems.find((i: any) => i.member_program_item_id === -1);
        const newItemTaxable = newItem?.therapies?.taxable === true;
        const itemCostWithTax = newItemCharge + (newItemTaxable ? newItemCharge * 0.0825 : 0);
        const availableCredit = lockedPrice - projectedPrice + itemCostWithTax;
        const overBy = itemCostWithTax - availableCredit;
        throw new Error(
          `Cannot add item: Cost $${itemCostWithTax.toFixed(2)} (incl. tax) exceeds available credit of $${availableCredit.toFixed(2)} by $${overBy.toFixed(2)}`
        );
      }
      // For margin violations or other operations, use the original error
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

  } catch (error) {
    // If validation fails, throw error to prevent the item change
    throw error;
  }
}

/**
 * Validate Active program changes and update variance/margin
 * Only applies to programs with contracted_at_margin set
 */
export async function validateAndUpdateActiveProgramFinances(
  supabase: any,
  memberProgramId: number
) {
  try {
    // Get program status and finances
    const { data: program, error: programError } = await supabase
      .from('member_programs')
      .select('program_status_id, program_status(status_name)')
      .eq('member_program_id', memberProgramId)
      .single();

    if (programError || !program) return;

    const statusName = (program.program_status as any)?.status_name?.toLowerCase();
    if (statusName !== 'active') return; // Only validate Active programs

    // Get current finances with contracted_at_margin
    const { data: finances, error: financesError } = await supabase
      .from('member_program_finances')
      .select('final_total_price, contracted_at_margin, finance_charges, discounts')
      .eq('member_program_id', memberProgramId)
      .single();

    if (financesError || !finances || !finances.contracted_at_margin) return;

    // Get current items to calculate projected values
    const { data: items, error: itemsError } = await supabase
      .from('member_program_items')
      .select(`
        quantity,
        item_cost,
        item_charge,
        therapies(taxable)
      `)
      .eq('member_program_id', memberProgramId)
      .eq('active_flag', true);

    if (itemsError || !items) return;

    // Calculate current totals
    let totalCost = 0;
    let totalCharge = 0;
    let totalTaxableCharge = 0;

    items.forEach((item: any) => {
      const quantity = item.quantity || 1;
      const cost = item.item_cost || 0;
      const charge = item.item_charge || 0;
      const isTaxable = item.therapies?.taxable === true;

      totalCost += cost * quantity;
      totalCharge += charge * quantity;
      
      if (isTaxable) {
        totalTaxableCharge += charge * quantity;
      }
    });

    // Calculate projected values
    const taxes = calculateTaxesOnTaxableItems(
      totalCharge,
      totalTaxableCharge,
      Number(finances.discounts || 0)
    );
    const projectedPrice = calculateProjectedPrice(
      totalCharge,
      taxes,
      Number(finances.finance_charges || 0),
      Number(finances.discounts || 0)
    );
    
    // Calculate margin on locked price using centralized function
    const lockedPrice = Number(finances.final_total_price || 0);
    const financeCharges = Number(finances.finance_charges || 0);
    const marginOnLockedPrice = calculateProjectedMargin(
      lockedPrice,
      totalCost,
      financeCharges,
      taxes
    );

    // Validate against bounds
    const validation = validateActiveProgramChanges({
      projectedPrice,
      projectedMargin: marginOnLockedPrice,
      lockedPrice: lockedPrice,
      contractedAtMargin: Number(finances.contracted_at_margin || 0)
    });

    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Calculate and update variance
    const variance = calculateVariance(projectedPrice, lockedPrice);

    // Update finances with variance and corrected margin
    await supabase
      .from('member_program_finances')
      .update({
        variance: variance,
        margin: marginOnLockedPrice,
        updated_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .eq('member_program_id', memberProgramId);

  } catch (error: any) {
    // If validation fails, throw error to prevent the item creation
    throw error;
  }
}