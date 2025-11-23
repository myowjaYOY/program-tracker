# Finance Charges Display Logic

## ✅ **Update Complete**

Added logic to handle negative finance charges in template generation.

---

## 📋 **Business Rule**

**Negative finance charges:**
- ❌ Should NOT display in customer-facing documents
- ✅ DO affect margin calculations (internal use)
- ✅ Pass `$0.00` to templates instead of negative values

**Positive finance charges:**
- ✅ Display normally in documents
- ✅ Add to program price

---

## 🔧 **Implementation**

### Code Change Applied to 4 Functions:
1. `handleGenerateNewContractOptions` (Contract Options button)
2. `handleGenerateQuote` (Quote generation)
3. `handleGenerateContract` (Legacy contract)
4. `handleGenerateContractDoc` (Contract button)

### Before:
```typescript
financials: {
  financeCharges: finances?.finance_charges || 0,
  // ...
}
```

### After:
```typescript
financials: {
  financeCharges: Math.max(0, finances?.finance_charges || 0), // Pass 0 if negative (affects margin only)
  // ...
}
```

---

## 💡 **How It Works**

### Examples:

| Database Value | Passed to Template | Displays As |
|---------------|-------------------|-------------|
| `500.00` | `500.00` | `$500.00` |
| `0.00` | `0.00` | `$0.00` |
| `-250.00` | `0.00` ✅ | `$0.00` |
| `-1000.00` | `0.00` ✅ | `$0.00` |

### Formula:
```typescript
Math.max(0, financeCharges)
```
- If `financeCharges >= 0` → returns the value
- If `financeCharges < 0` → returns `0`

---

## 📊 **Use Case: Lisa Leibig Example**

If Lisa Leibig's program had:
- **Finance Charges in DB:** `-$500.00` (reduces margin)
- **What Template Receives:** `$0.00`
- **What Customer Sees:** `$0.00` (or blank if zero handling in template)

This prevents confusing negative charges from appearing on customer documents while still allowing them to affect internal margin calculations.

---

## 🎯 **Impact on Documents**

### Templates Affected:
✅ `contract-template.docx` - Contract button  
✅ `contract-options-template.docx` - Contract Options button  
✅ `quote-template.docx` - Quote generation  

### Template Field:
```
FINANCE_CHARGES bookmark
```

Will now show:
- Positive values as-is: `$500.00`
- Zero or negative values: `$0.00`

---

## ✅ **Status: Complete**

- ✅ Code updated in all 4 document generation functions
- ✅ No linting errors
- ✅ Logic tested with `Math.max()` function
- ✅ Customer-facing documents protected from negative charge display

**Negative finance charges now display as $0.00 in all generated documents!** 🎉

