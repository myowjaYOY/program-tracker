# Margin Calculation Discrepancy Analysis

**Date**: October 23, 2025  
**Issue**: Program Audit page shows 2 programs with issues, but manual analysis shows 5

---

## EXECUTIVE SUMMARY

**The discrepancy is NOT a bug** - it's a difference in **business logic interpretation**.

Your system is **consistently calculating margins on DISCOUNTED/FINAL PRICE**, which is correct according to the code's design. My analysis calculated margins on FULL CHARGE (before discounts), which is a different methodology.

---

## THE TWO MARGIN CALCULATION METHODS

### Method 1: Margin on Full Charge (Before Discounts)
```
Revenue = totalCharge
Margin = ((charge - cost) / charge) × 100
```

**Example - Program #55:**
- Charge: $7,912.00
- Cost: $803.20
- Margin: (($7,912 - $803.20) / $7,912) × 100 = **89.84%**

**Business Interpretation**: "This item has an 89.84% profit margin at list price"

---

### Method 2: Margin on Final Price (After Discounts) ← YOUR SYSTEM
```
Revenue = totalCharge + taxes + financeCharges + discounts
Margin = ((finalPrice - taxes - cost) / (finalPrice - taxes)) × 100
```

**Example - Program #55:**
- Charge: $7,912.00
- Discounts: -$5,687.38
- Taxes: $5.59
- Final Price: $2,230.21
- Margin: (($2,230.21 - $5.59 - $803.20) / ($2,230.21 - $5.59)) × 100 = **63.89%**

**Business Interpretation**: "After giving a $5,687 discount, the actual profit margin is 63.89%"

---

## HOW YOUR SYSTEM WORKS

### The Code (financial-calculations.ts)

```typescript
export function calculateProjectedPrice(
  totalCharge: number,
  taxes: number,
  financeCharges: number,
  discounts: number  // ← NEGATIVE value like -$5,687
): number {
  const financeRevenue = Math.max(financeCharges, 0);
  return totalCharge + taxes + financeRevenue + discounts;
  //     $7,912     + $5.59 + $0            + (-$5,687) = $2,230.59
}

export function calculateProjectedMargin(
  projectedPrice: number,  // ← $2,230.59 (after discounts)
  totalCost: number,       // ← $803.20
  financeCharges: number,
  taxes: number            // ← $5.59
): number {
  const preTaxRevenue = projectedPrice - taxes;  // $2,225
  const adjustedCost = /* ... */ totalCost;      // $803.20
  
  return ((preTaxRevenue - adjustedCost) / preTaxRevenue) * 100;
  //     (($2,225 - $803.20) / $2,225) × 100 = 63.89%
}
```

**Your system uses Method 2**: Margin is calculated on the FINAL DISCOUNTED PRICE.

---

## WHY THE AUDIT SHOWS ONLY 2 PROGRAMS

The Audit API route (verify-data-integrity) uses the **exact same calculation logic**:

```typescript
// Line 182-187
const calculatedPrice = calculateProjectedPrice(
  calculatedCharge,
  calculatedTaxes,
  Number(finances?.finance_charges || 0),
  Number(finances?.discounts || 0)  // ← Includes discounts
);

// Line 206-211
expectedMargin = calculateProjectedMargin(
  calculatedPrice,  // ← Uses discounted price
  calculatedCost,
  financeCharges,
  calculatedTaxes
);
```

So the audit calculates:
- Program #55: Expected margin = **63.89%**, Stored margin = **63.89%** ✅ MATCH
- Program #56: Expected margin = **75.66%**, Stored margin = **75.66%** ✅ MATCH
- Program #61: Expected margin = **72.51%**, Stored margin = **72.51%** ✅ MATCH

**The audit doesn't flag these because they match the stored values!**

---

## WHY MY ANALYSIS SHOWED 5 PROGRAMS

My SQL query calculated margin on **full charge** (before discounts):

```sql
CASE 
  WHEN (mp.total_charge - mpf.taxes) > 0 
  THEN ((mp.total_charge - mpf.taxes - cost) / (mp.total_charge - mpf.taxes)) × 100
  -- Uses total_charge directly, NOT final_price
END as calculated_margin
```

This gave:
- Program #55: My calc = **89.84%**, Stored = **63.89%** ❌ MISMATCH (-25.95%)

But this is comparing apples to oranges - two different methodologies.

---

## WHICH METHOD IS CORRECT?

Both are valid depending on your business needs:

### Method 1 (Margin on Full Charge) - Retail Standard
**Pros:**
- ✅ Shows base product profitability
- ✅ Consistent across all programs
- ✅ Easier to compare margins
- ✅ Industry standard for retail/manufacturing
- ✅ Separates pricing strategy from product profitability

**Cons:**
- ❌ Doesn't show actual profit after discounts
- ❌ Can be misleading if heavy discounts are common

**When to use**: When you want to know "Is this product profitable at list price?"

---

### Method 2 (Margin on Final Price) ← YOUR CURRENT SYSTEM
**Pros:**
- ✅ Shows ACTUAL profit margin after discounts
- ✅ Reflects reality of what customer pays
- ✅ Better for understanding real profitability

**Cons:**
- ❌ Margins vary wildly based on discount strategy
- ❌ Hard to compare programs with different discount levels
- ❌ A high-margin product looks low-margin with big discounts
- ❌ Confusing when same product has different margins due to discounts

**When to use**: When you want to know "How much profit did we actually make on this sale?"

---

## THE ACTUAL 2 PROGRAMS WITH ISSUES

The audit found 2 programs with REAL calculation errors (likely the ones we just fixed):

These were programs where:
- Stored cost ≠ Sum of item costs
- OR Stored margin ≠ Calculated margin (even using Method 2)

---

## RECOMMENDATION

Your system is **working as designed**. The audit is correct.

However, **Method 2 can be confusing** because:

1. **Program #55** shows 63.89% margin
2. **Program #56** shows 75.66% margin  
3. Both use the same template and items!

The only difference is discount amount. This makes it hard to know your base profitability.

### Option A: Keep Current System (Method 2)
- No changes needed
- Document that "margin = profit after discounts"
- Accept that margins vary by discount level

### Option B: Switch to Method 1 (Margin on Full Charge)
- Calculate margin on totalCharge (before discounts)
- Show discounts separately
- Margin becomes consistent per template
- Would require:
  1. Update calculateProjectedPrice to NOT include discounts
  2. Handle discounts separately in final price calculation
  3. Recalculate all stored margins
  4. Update UI to show "Base Margin" and "Actual Profit"

### Option C: Show Both (Recommended)
- **Base Margin**: Calculated on full charge
- **Effective Margin**: Calculated on final price
- Gives complete picture
- Best of both worlds

---

## CONCLUSION

**The audit is working correctly.** It shows 2 programs because only 2 have calculation errors.

The 5 programs I flagged aren't "wrong" - they just use Method 2 (margin on discounted price) instead of Method 1 (margin on full charge).

**Question for you**: Which margin methodology do you want to use going forward?

1. Current (Method 2) - Margin after discounts?
2. Method 1 - Margin before discounts?  
3. Both - Show base margin AND effective margin?

