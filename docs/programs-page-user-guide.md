## Programs Page – User Guide

This guide explains how to use the Programs page to review program details, adjust financials, and understand payments.

## What you can do here
- View and edit basic program info
- Review Financials (price, margin, taxes, financing)
- See the schedule of payments
- Manage program items (therapies) and tasks

## Tabs at a glance
- PROGRAM: Basic details like name, status, dates
- FINANCIALS: Program price, financing, discounts, taxes, margin
- PAYMENTS: Read-only list of scheduled payments
- ITEMS: The therapies/items that make up the program
- TASKS: Activities linked to the program

## Financials
Financials determine the Program Price and the payment schedule.

- Total Charge: Sum of item charges (from the Items tab)
- Finance Charges: Extra costs (can be positive or negative)
- Discounts: Reductions (always negative)
- Taxes: Shown for reference; not part of Program Price
- Program Price: Total Charge + Finance Charges + Discounts
- Margin (%): Based on Program Price vs Total Cost
  - Green ≥ 80%; Orange ≥ 75% and < 80%; Red < 75%
- Financing Type: Pick how the program will be financed

Tip: You can type percentages (like 10%) in Finance Charges or Discounts; when you leave the field, it converts to a dollar amount using Total Charge.

### Saving on the Financials tab
When you click Save Changes:
1) Your financial details are saved
2) Payments are automatically created or updated when needed
   - First time: payments are generated automatically
   - Later: payments are updated when Financing Type, Finance Charges, Discounts, or the Program Price (from Items) changed

If any payment is already marked Paid, the schedule will not be replaced. Your financials still save, and you’ll see a notice that payments weren’t updated.

### Banner about Program Price
If Items changed the Total Charge since your last save, you’ll see a banner: “Program Price changed because Items were updated. Saving will update payments accordingly.” Save to refresh the schedule.

## Payments
The Payments tab shows the schedule (read-only):
- Due Date, Paid Date, Amount, Status, Method, Reference, Notes
- Dates are shown as local dates
- Status starts as Pending; Paid adds a Paid Date

How payments are created on Save:
- External financing OR “Full Payment”: one payment due today for the full Program Price
- Internal financing (e.g., “Financed - 3 Pay”): creates that many equal payments, 30 days apart

## Items
Changing quantities or items updates Total Charge on the program. If that changes Program Price, the Financials tab will show the banner and saving there will update payments for you.

## Common tasks
- Update the financing plan:
  1) Choose a Financing Type
  2) Adjust Finance Charges/Discounts if needed (you can type %)
  3) Click Save Changes (payments update automatically)

- Change item quantities:
  1) Go to Items, change quantities, save
  2) Go to Financials: you’ll see the banner
  3) Click Save Changes to refresh payments

- Record a payment (outside this page):
  - Marking a payment Paid prevents the schedule from being regenerated in the future

## FAQs
- Why didn’t payments change after Save?
  - At least one payment is already Paid, so the schedule is preserved
- Does changing Taxes affect payments?
  - No. Taxes are informational and do not change the Program Price

---

## Exporting this guide (optional)
- To generate a PDF from this page, you can run (no install):
  - `npx md-to-pdf docs/programs-page-user-guide.md --dist docs/Programs-User-Guide.pdf`
- Or open the file in your editor/markdown viewer and “Print to PDF”.



