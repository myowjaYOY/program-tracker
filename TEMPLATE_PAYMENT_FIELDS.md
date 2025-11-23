# Payment Fields Available in Templates

## ✅ **Payment Notes Now Available!**

You can now use **`payment.notes`** in your Word document templates.

---

## 📝 **All Available Payment Fields**

When iterating through payments in your templates, you can use these fields:

| Template Variable | Description | Example Value |
|------------------|-------------|---------------|
| `payment.paymentId` | Unique payment ID | `825` |
| `payment.amount` | Payment amount | `5000.00` or `1678.05` |
| `payment.dueDate` | Payment due date | `11/18/2025` |
| `payment.paymentDate` | Actual payment date (optional) | `11/18/2025` or empty |
| `payment.notes` | Payment notes | `"Cherry Finance"` or `"$5,000 DP w/ Cherry"` |

---

## 📄 **How to Use in Your Template**

### Important: Template Syntax
Your templates use `docx-templates` with the `+++` delimiter. Use this syntax:

**For loops:**
```
+++FOR payment IN payments+++
  [content here]
+++END-FOR payment+++
```

**For variables:**
```
+++payment.amount+++
+++payment.notes+++
```

### Example 1: Display Payment with Notes
```
Amount: +++payment.amount+++
Due Date: +++payment.dueDate+++
Notes: +++payment.notes+++
```

### Example 2: Payment Table Row (inside a FOR loop)
```
+++FOR payment IN payments+++
| +++payment.amount+++ | +++payment.dueDate+++ | +++payment.paymentDate+++ | +++payment.notes+++ |
+++END-FOR payment+++
```

### Example 3: Full Payment Section
```
Payment Schedule:

+++FOR payment IN payments+++
Payment #+++payment.paymentId+++
Amount: +++payment.amount+++
Due Date: +++payment.dueDate+++
Notes: +++payment.notes+++

+++END-FOR payment+++
```

---

## 🔧 **Technical Details**

### What Was Changed:
Updated **4 functions** in `src/components/programs/program-info-tab.tsx`:
1. `handleGenerateNewContractOptions` (Contract Options button)
2. `handleGenerateQuote` (Quote generation)
3. `handleGenerateContract` (Legacy contract generation)
4. `handleGenerateContractDoc` (New Contract button)

### Code Change:
```typescript
// BEFORE
payments: (payments || []).map(payment => ({
  paymentId: payment.member_program_payment_id,
  amount: payment.payment_amount || 0,
  dueDate: payment.payment_due_date ? new Date(...).toLocaleDateString() : 'Not set',
  ...(payment.payment_date && { paymentDate: new Date(...).toLocaleDateString() }),
}))

// AFTER
payments: (payments || []).map(payment => ({
  paymentId: payment.member_program_payment_id,
  amount: payment.payment_amount || 0,
  dueDate: payment.payment_due_date ? new Date(...).toLocaleDateString() : 'Not set',
  ...(payment.payment_date && { paymentDate: new Date(...).toLocaleDateString() }),
  notes: payment.notes || '',  // ← NEW!
}))
```

---

## 📌 **Where This Works**

Payment notes are now available in **ALL** document templates:
- ✅ **Contract** template (`contract-template.docx`)
- ✅ **Contract Options** template (`contract-options-template.docx`)
- ✅ **Quote** template (`quote-template.docx`)
- ✅ Plan Summary (if payments are included)

---

## 💡 **Example Use Case**

For Lisa Leibig's program, the payment note is:
```
"Cherry Finance"
```

In your template, you can now display this alongside the payment details:
```
Payment 1: $5,000.00 due 11/18/2025
Note: Cherry Finance
```

---

## ✅ **Status: READY TO USE**

You can now add `{payment.notes}` or `payment.notes` (depending on your template syntax) to any of your Word document templates to display payment notes!

