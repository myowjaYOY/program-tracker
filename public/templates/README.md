# Word Document Templates

This directory contains Word document templates for generating quotes and contracts.

## Template Files Required

### 1. Quote Template (`quote-template.docx`)

Create a Word document with the following bookmarks:

#### Member Information Section
- `MEMBER_NAME` - Member's full name
- `MEMBER_EMAIL` - Member's email address  
- `MEMBER_PHONE` - Member's phone number
- `MEMBER_ADDRESS` - Member's address

#### Program Information Section
- `PROGRAM_NAME` - Name of the program
- `PROGRAM_DESCRIPTION` - Program description
- `PROGRAM_START_DATE` - Program start date
- `PROGRAM_DURATION` - Program duration

#### Financial Information Section
- `FINANCE_CHARGES` - Finance charges amount
- `TAXES` - Taxes amount
- `DISCOUNTS` - Discounts amount
- `FINAL_TOTAL_PRICE` - Final total price (highlighted)
- `MARGIN` - Margin percentage

#### Payment Schedule Section
- `PAYMENT_SCHEDULE` - Formatted payment schedule list
- `TOTAL_PAYMENTS` - Total number of payments
- `PAID_PAYMENTS` - Number of paid payments
- `PENDING_PAYMENTS` - Number of pending payments

#### Footer
- `GENERATED_DATE` - Date the quote was generated

## How to Create Bookmarks in Word

1. Open your Word document
2. Select the text you want to replace with dynamic content
3. Go to **Insert** tab → **Bookmark**
4. Enter a unique bookmark name (use the names listed above)
5. Click **Add**
6. Repeat for all placeholders

## Example Template Structure

```
PROGRAM QUOTE

Member Information:
Name: [MEMBER_NAME]
Email: [MEMBER_EMAIL]
Phone: [MEMBER_PHONE]
Address: [MEMBER_ADDRESS]

Program Information:
Program: [PROGRAM_NAME]
Description: [PROGRAM_DESCRIPTION]
Start Date: [PROGRAM_START_DATE]
Duration: [PROGRAM_DURATION]

Financial Summary:
Finance Charges: [FINANCE_CHARGES]
Taxes: [TAXES]
Discounts: [DISCOUNTS]
Final Total Price: [FINAL_TOTAL_PRICE]
Margin: [MARGIN]

Payment Schedule:
[PAYMENT_SCHEDULE]

Summary:
Total Payments: [TOTAL_PAYMENTS]
Paid: [PAID_PAYMENTS]
Pending: [PENDING_PAYMENTS]

Generated on: [GENERATED_DATE]
```

## Notes

- Bookmarks must be unique and match the names exactly
- The template will preserve all formatting from your original document
- Images and complex formatting will be maintained
- Only the bookmarked text will be replaced

