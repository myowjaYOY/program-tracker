# Actual Data Investigation: Phase I WLP - Semiglutide

## Program Details
- **Program ID:** 63
- **Member:** Dameria Boston  
- **Template:** Phase I WLP - Semiglutide
- **Status:** Active
- **Locked Price:** $3,900.00

## Database Values
```
total_cost: $1,163.20
total_charge: $7,912.00
finance_charges: $0.00
discounts: -$4,021.78
taxes: $9.78
final_total_price (locked): $3,900.00
variance: -$0.00
margin: 70.10%
contracted_at_margin: 70.01%
```

## Items Breakdown (14 items)
| Item | Qty | Charge | Taxable | Total |
|------|-----|--------|---------|-------|
| Core Restore Kit - Vanilla | 1 | $149.00 | ✓ | $149.00 |
| SBI Protect Powder | 1 | $92.00 | ✓ | $92.00 |
| PROGRAM LABS (YOY) | 1 | $1,055.50 | | $1,055.50 |
| WELLNESS PANEL (YOY) | 2 | $44.50 | | $89.00 |
| Coaching Session - Mindset | 12 | $36.00 | | $432.00 |
| Lab Review | 1 | $375.00 | | $375.00 |
| Program ReCap and Maintenance Plan | 1 | $750.00 | | $750.00 |
| Weight Loss Check In | 6 | $125.00 | | $750.00 |
| Weight Loss Orientation | 1 | $125.00 | | $125.00 |
| YOY University 3 Month | 1 | $1,800.00 | | $1,800.00 |
| Semiglutide Injection Bundle | 6 | $300.00 | | $1,800.00 |
| Coaching Session - Wellness | 12 | $36.00 | | $432.00 |
| Program Member Graduation | 1 | $0.00 | | $0.00 |
| Detox Nutritional Visit | 1 | $62.50 | | $62.50 |
| **TOTAL** | | | | **$7,912.00** |
| **TAXABLE ONLY** | | | | **$241.00** |

## Manual Price Calculation

### Step 1: Apply Discounts to Taxes
- Total Charge: $7,912.00
- Discounts: -$4,021.78
- Taxable Charge: $241.00
- Taxable Percentage: $241 / $7,912 = 3.046%
- Discount applied to taxable: $4,021.78 × 3.046% = $122.50
- Taxable base after discount: $241.00 - $122.50 = $118.50

### Step 2: Calculate Taxes
- Tax Rate: 8.25%
- Taxes: $118.50 × 0.0825 = **$9.78** ✓

### Step 3: Calculate Projected Price
```
Projected Price = totalCharge + taxes + financeCharges + discounts
                = $7,912.00 + $9.78 + $0.00 + (-$4,021.78)
                = $3,900.00
```

### Step 4: Compare to Locked Price
```
Projected Price: $3,900.00
Locked Price:    $3,900.00
Variance:        -$0.00
```

## ✅ CORRECT CALCULATION RESULT

**The projected price EQUALS the locked price - NO VIOLATION!**

---

## ❌ THE PROBLEM: Frontend Display Bug

### Console Error Said:
```
projectedPrice: 7931.8825
lockedPrice: 3900
difference: 4031.8824999999997
```

### Actual Reality:
```
projectedPrice: 3900.00
lockedPrice: 3900.00
difference: 0.00
```

## Root Cause Analysis

The value **$7,931.88** appears to be:
```
$7,912.00 (items) + $19.88 (incorrect tax calculation)
```

This suggests the frontend is:
1. ✅ Getting the correct items total ($7,912)
2. ❌ Calculating taxes INCORRECTLY (without discount: $241 × 0.0825 = $19.88)
3. ❌ NOT applying discounts before displaying
4. ❌ Showing: items + wrong_taxes = $7,931.88

### Where the Bug Is

Looking at `useFinancialsDerived.ts` line 46:
```typescript
const result = calculateProgramFinancials(params);
```

And then line 78:
```typescript
if (result.programPrice > lockedPrice + 0.01) {
  console.error('⚠️ CRITICAL: Projected price exceeds locked price!', {
    projectedPrice: result.programPrice,  // <-- This is $7,931.88
    lockedPrice: lockedPrice,  // <-- This is $3,900.00
  });
}
```

**The `result.programPrice` from `calculateProgramFinancials()` is $7,931.88**

But then on line 66:
```typescript
programPrice = lockedPrice;  // <-- Sets display to $3,900 (correct)
```

**So the DISPLAY shows $3,900 (correct), but the VALIDATION checks $7,931.88 (wrong)!**

## The REAL Problem

The `calculateProgramFinancials()` function is returning $7,931.88 because:

**In `financial-calculations.ts` line 161:**
```typescript
const taxes = calculateTaxesOnTaxableItems(totalCharge, totalTaxableCharge, discounts);
const programPrice = calculateProjectedPrice(totalCharge, taxes, financeCharges, discounts);
```

Wait... it DOES pass discounts. So why is the calculation wrong?

Let me check the actual values being passed to the hook...

## Next Step Required

I need to check what values are being passed to `useFinancialsDerived` in the component. The discounts might not be getting passed correctly, OR the `totalTaxableCharge` might be wrong.

The console error is showing $7,931.88 which means:
- Either discounts are NOT being passed ($0 instead of -$4,021.78)
- OR taxes are being calculated on the wrong base
- OR both

**The database has CORRECT values** - this is purely a frontend calculation bug in `useFinancialsDerived`.


