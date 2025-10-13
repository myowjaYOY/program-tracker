# Template Creation Instructions

## Quick Start

1. **Create a Word document** with your desired layout and formatting
2. **Add bookmarks** where you want dynamic content to appear
3. **Save as** `quote-template.docx` (quotes) or `New-Contract-Template.docx` (options) in this directory
4. **Test** the Quote/Contract/Options buttons on the Programs page

## Required Bookmarks

Copy and paste these bookmark names into your Word document:

```
MEMBER_NAME
MEMBER_EMAIL  
MEMBER_PHONE
MEMBER_ADDRESS
PROGRAM_NAME
PROGRAM_DESCRIPTION
PROGRAM_START_DATE
PROGRAM_DURATION
FINANCE_CHARGES
TAXES
DISCOUNTS
FINAL_TOTAL_PRICE
MARGIN
PAYMENT_SCHEDULE
TOTAL_PAYMENTS
PAID_PAYMENTS
PENDING_PAYMENTS
GENERATED_DATE
```

### Additional Bookmarks (New Contract Options template)

Use these in `New-Contract-Template.docx` to display payment options at consult time. All values are currency, 2 decimals.

```
DISCOUNTED_PRETAX_5_AMOUNT        // 5% of pre‑tax (discount amount)
DISCOUNTED_PROGRAM_PRICE_5        // Program price after 5% pre‑tax discount with taxes recomputed on taxable items
FINANCE_FULL_AMOUNT               // Program price + 6% of pre‑tax
FINANCE_DOWN_PAYMENT              // 25% of finance full amount
FINANCE_MONTHLY_PAYMENT           // (finance full amount − down payment) / 5
THREE_EQUAL_PAYMENTS              // Program price / 3
```

## Template Example

```
PROGRAM QUOTE

Member: [MEMBER_NAME]
Email: [MEMBER_EMAIL]
Phone: [MEMBER_PHONE]

Program: [PROGRAM_NAME]
Description: [PROGRAM_DESCRIPTION]
Start Date: [PROGRAM_START_DATE]

Investment:
Finance Charges: [FINANCE_CHARGES]
Taxes: [TAXES]  
Discounts: [DISCOUNTS]
Total: [FINAL_TOTAL_PRICE]
Margin: [MARGIN]

Payment Schedule:
[PAYMENT_SCHEDULE]

Generated: [GENERATED_DATE]
```

## How to Add Bookmarks in Word (CRITICAL STEPS)

### Method 1: Standard Bookmark Creation
1. **Select the text** you want to replace (e.g., "[MEMBER_NAME]")
2. Go to **Insert → Bookmark**
3. Type the bookmark name **EXACTLY** as shown (e.g., "MEMBER_NAME") - NO brackets, NO spaces
4. Click **Add**
5. Repeat for all placeholders

### Method 2: Alternative Approach (If Method 1 doesn't work)
1. **Place your cursor** where you want the bookmark
2. Go to **Insert → Bookmark**
3. Type the bookmark name (e.g., "MEMBER_NAME")
4. Click **Add**
5. The bookmark will be an invisible marker at that location

### IMPORTANT BOOKMARK RULES:
- ✅ Bookmark names must be EXACTLY as listed (case-sensitive)
- ✅ NO brackets in bookmark names
- ✅ NO spaces or special characters
- ✅ Each bookmark name must be unique
- ❌ Don't include [ ] in the bookmark name
- ❌ Don't use spaces in bookmark names

## Testing

Once you create the template:
1. Save it as `quote-template.docx`, `contract-template.docx`, or `New-Contract-Template.docx` in this directory
2. Go to the Programs page
3. Click the corresponding button (Quote / Contract / New Contract Options)
4. Your formatted document will be generated!

## Troubleshooting

If bookmarks aren't being replaced:
- Ensure bookmark names match exactly (case-sensitive)
- Don't include brackets in bookmark names
- Remove any hidden bookmarks that might interfere
- Check that bookmarks are properly placed around the text to replace

