# Program Pricing & Workflow Guide

**Last Updated**: October 23, 2025  
**For**: Program Coordinators, Sales Team, and Administrative Staff

---

## Table of Contents

1. [Overview](#overview)
2. [Program Lifecycle](#program-lifecycle)
3. [Program Statuses Explained](#program-statuses-explained)
4. [Status Transition Rules](#status-transition-rules)
5. [Understanding Program Pricing](#understanding-program-pricing)
6. [How Pricing is Calculated](#how-pricing-is-calculated)
7. [Key Financial Terms](#key-financial-terms)
8. [What Happens When You Change Program Status](#what-happens-when-you-change-program-status)
9. [Adding or Removing Items from Active Programs](#adding-or-removing-items-from-active-programs)
10. [Understanding Program Margin](#understanding-program-margin)
11. [Common Scenarios](#common-scenarios)
12. [Frequently Asked Questions](#frequently-asked-questions)

---

## Overview

This guide explains how member programs move through different stages (from initial quote to completion) and how pricing is calculated at each stage. Understanding these concepts will help you:

- Create accurate quotes for potential members
- Transition programs through their lifecycle correctly
- Understand how pricing changes affect program financials
- Manage customer expectations about pricing and payments

---

## Program Lifecycle

A member program goes through several stages during its lifetime:

```
Quote → Active → Paused/Completed/Cancelled
          ↓
        Paused → Active/Completed/Cancelled
```

### Key Principle: **One-Way Street from Quote to Active**

Once a program moves from **Quote** to **Active** status, it **cannot** go back to Quote. This is by design to protect financial integrity and ensure proper tracking of contracted programs.

---

## Program Statuses Explained

### 🟡 Quote (Initial Stage)
**What it means**: You're preparing a proposal for a potential member.

**Characteristics**:
- Pricing is **flexible** and can change
- No payments required yet
- Items can be freely added or removed
- Margin calculations are **estimated** based on current pricing
- No locked-in price or contract

**When to use**: 
- Initial consultations
- Building custom program packages
- Revising proposals before customer commitment

---

### 🟢 Active (Contracted Programs)
**What it means**: The customer has agreed to the program and made their first payment.

**Characteristics**:
- Price is **locked** at the contracted amount
- Customer has paid or committed to pay the contracted total
- A **variance** (credit pool) is created if you add more items later
- Margin is calculated on the **locked price**, not projected costs
- Requires a **Financing Type** to be selected
- Requires at least **one payment** to be recorded

**When to use**:
- Customer has signed agreement
- First payment received
- Program is actively being delivered

---

### 🟠 Paused (Temporarily Inactive)
**What it means**: The program is on hold but may resume later.

**Characteristics**:
- Price remains **locked** (same as Active)
- Variance and contracted margin are maintained
- No new payments expected while paused
- Can return to Active status when ready

**When to use**:
- Customer requests temporary break (health, travel, etc.)
- Waiting for lab results before proceeding
- Seasonal pauses (summer vacation, holidays)

**Important**: Paused programs **cannot** go back to Quote status.

---

### ✅ Completed (Final State)
**What it means**: The program has been successfully finished.

**Characteristics**:
- Final status - **cannot be changed**
- All financials are locked
- Historical record of the program

**When to use**:
- Customer has finished all program components
- All services have been delivered
- Final reconciliation complete

---

### ❌ Cancelled (Final State)
**What it means**: The program was terminated before completion.

**Characteristics**:
- Final status - **cannot be changed**
- All financials are locked at time of cancellation
- Historical record maintained

**When to use**:
- Customer withdrew from program
- Program was not a good fit
- Refund processed (if applicable)

---

## Status Transition Rules

### ✅ Valid Transitions

| From Status | Can Change To | Reason |
|------------|---------------|--------|
| **Quote** | Active | Customer committed and paid |
| **Quote** | Cancelled | Customer declined |
| **Active** | Paused | Temporary break needed |
| **Active** | Completed | Program successfully finished |
| **Active** | Cancelled | Program terminated |
| **Paused** | Active | Resuming program |
| **Paused** | Completed | Completing without resuming |
| **Paused** | Cancelled | Program terminated |

### 🚫 Invalid Transitions (System Will Block)

| From Status | Cannot Change To | Why Not? |
|------------|------------------|----------|
| **Active** | Quote | Price is locked; would break financial tracking |
| **Paused** | Quote | Price is locked; would break financial tracking |
| **Completed** | Any | Final state; historical record |
| **Cancelled** | Any | Final state; historical record |

### 📋 Requirements Before Going Active

Before you can change a program to **Active** status, you **must**:

1. ✅ Select a **Financing Type** (e.g., "Cash", "Payment Plan", "Insurance")
2. ✅ Record at least **one payment**

If these aren't completed, the Active option will be **grayed out** in the status dropdown with a note explaining why.

---

## Understanding Program Pricing

### The Basic Formula

Every program's price is built from these components:

```
Total Charge (sum of all therapy items)
+ Taxes (8.25% on taxable items only)
+ Finance Charges (if positive)
+ Discounts (negative number, reduces price)
= Final Total Price
```

### Example Breakdown

Let's say you're creating a program:

| Component | Amount | Notes |
|-----------|--------|-------|
| Total Charge | $20,000 | Sum of all therapy items |
| Taxes | $1,650 | 8.25% on taxable items |
| Finance Charges | $0 | None in this example |
| Discounts | -$2,000 | Customer discount applied |
| **Final Total Price** | **$19,650** | What customer pays |

---

## How Pricing is Calculated

### Stage 1: Quote (Flexible Pricing)

When creating a quote:

1. **Select therapy items** from your templates
2. System calculates:
   - Total Cost (what we pay for items)
   - Total Charge (what we charge customer)
   - Estimated taxes
   - Projected margin (profitability)

3. You can adjust:
   - Add or remove items
   - Apply discounts
   - Add finance charges (if payment plan needed)

4. **Everything is flexible** - numbers update as you make changes

---

### Stage 2: Going Active (Price Lock)

When you change status to Active:

1. The **Final Total Price is locked** 
   - This becomes the contracted amount
   - Customer commits to pay this amount
   - Recorded in `final_total_price` field

2. **Contracted Margin is recorded**
   - The margin percentage at time of contract
   - Becomes the benchmark for profitability
   - Recorded in `contracted_at_margin` field

3. **Initial variance is zero**
   - No difference between projected and locked price yet
   - Will change if you modify program later

---

### Stage 3: Active Programs (Variance Tracking)

Once a program is Active, here's how pricing works:

#### If You Add More Items:
- System recalculates the **Projected Price** (what it would cost now)
- Compares to **Locked Price** (what customer already paid)
- Creates a **Variance** (customer credit available)

**Example**:
```
Customer paid (locked price): $19,650
After adding items (projected price): $21,200
Variance: -$1,550 (customer has $1,550 credit available)
```

This means:
- ✅ Customer has **credit pool** of $1,550 for additional items
- ✅ You can keep adding items up to this amount
- ✅ Margin is still calculated on the original locked price

#### If Projected Cost Exceeds Locked Price:
- The system uses **negative variance** to track customer credit
- Margin remains based on what customer paid (locked price)
- You can see how much credit remains for adding more items

---

## Key Financial Terms

### 1. Total Cost
**What it is**: How much we pay for all therapy items in the program.

**Example**: If program includes $5,000 in Semaglutide, $3,000 in supplements, and $2,000 in lab work, Total Cost = $10,000

**Important**: This is our expense, not what customer pays.

---

### 2. Total Charge
**What it is**: The base price we charge customer for all items (before taxes, discounts, etc.)

**Example**: Same items might be charged at $8,000 + $5,000 + $4,000 = $17,000 total charge

**Important**: This is the starting point for customer pricing.

---

### 3. Taxes
**What it is**: Sales tax applied to taxable items only (8.25% in our state).

**How it's calculated**:
- Only certain therapies are taxable (marked in system)
- If you apply a discount, tax is calculated on the **discounted price**
- Non-taxable items (like medical services) don't incur tax

**Example**:
```
Taxable items charge: $10,000
Discount applied: -$2,000
Discounted taxable amount: $8,000
Tax (8.25%): $660
```

---

### 4. Finance Charges
**What it is**: Additional charges or credits related to payment plans.

**Two types**:
- **Positive** (+): Customer pays more for payment plan (increases price)
- **Negative** (-): We pay processing fees (increases our cost)

**Example**: 
- Customer chooses 12-month payment plan with 5% fee
- Base price: $20,000
- Finance charge: +$1,000
- New total: $21,000

---

### 5. Discounts
**What it is**: Price reductions offered to customer (always stored as negative number).

**Common reasons**:
- Promotional offers
- Referral discounts
- Financial hardship adjustments
- Bundle pricing

**Example**:
```
Base charge: $20,000
Discount: -$3,000 (shown as -$3,000 in system)
Price after discount: $17,000
```

**Important**: Discounts affect both the customer's price AND the tax calculation.

---

### 6. Variance (Customer Credit Pool)
**What it is**: The difference between what customer paid (locked price) and what the current items would cost (projected price).

**Only applies to**: Active and Paused programs (not Quotes)

**Stored as negative number**: -$1,500 means customer has $1,500 credit available

**Example Scenario**:
```
Day 1 - Program Goes Active:
- Locked price: $20,000
- Variance: $0 (no difference yet)

Week 4 - Lab Results Show Need for Additional Item:
- Added: Extra B12 injections ($500)
- New projected price: $20,500
- Variance: -$500 (customer has $500 credit from original payment)

Week 8 - Add Another Item:
- Added: CoQ10 supplement ($300)
- New projected price: $20,800
- Variance: -$800 (customer credit pool now $800)
```

**What this means**:
- Customer paid $20,000 upfront
- We've added $800 worth of items
- Customer has "credit" that covers these additions
- We track this to ensure we don't exceed what they paid

---

### 7. Margin (Profitability)
**What it is**: The percentage of revenue that's profit after covering costs.

**How it's calculated**:
```
Margin = ((Revenue - Cost) / Revenue) × 100
```

**Two types in the system**:

#### a) Projected Margin (for Quotes)
- Based on current item prices
- Changes as you add/remove items
- Used for planning and proposals

#### b) Contracted Margin (for Active programs)
- Locked when program goes Active
- Based on the contracted price customer paid
- This is your **true profitability benchmark**

**Example**:
```
Quote Stage:
- Projected revenue: $20,000
- Total cost: $12,000
- Projected margin: 40%

After Going Active (with discount):
- Locked revenue: $18,000 (after $2k discount)
- Total cost: $12,000
- Contracted margin: 33.3% (this is locked)

After Adding Items:
- Items now cost: $14,000 (added $2k more)
- Locked revenue: Still $18,000
- Current margin: 22.2% (profit decreased)
- Contracted margin: Still shows 33.3% (benchmark)
- Variance: -$2,000 (customer has $2k credit)
```

---

## What Happens When You Change Program Status

### Quote → Active

**System automatically**:
1. ✅ Locks the Final Total Price
2. ✅ Records the Contracted Margin
3. ✅ Sets initial Variance to $0
4. ✅ Enables payment tracking
5. ✅ Creates program schedule (if configured)

**You must ensure**:
- Financing type is selected
- At least one payment is recorded
- All pricing is finalized (hard to adjust later)

---

### Active → Paused

**System automatically**:
- Maintains all locked pricing
- Preserves variance and margins
- Keeps payment history

**What changes**:
- Program removed from active coordination lists
- No new scheduled activities created
- Payment reminders paused (if applicable)

**You should**:
- Document reason for pause
- Set expected resume date (in notes)
- Communicate with customer about pause terms

---

### Active → Completed

**System automatically**:
- Locks all fields (no more edits)
- Finalizes all financial calculations
- Marks program as historical record

**You should**:
- Verify all payments received
- Confirm all items were delivered
- Complete any final reconciliation
- Document completion notes

**Cannot be undone** - this is a permanent status.

---

### Any Status → Cancelled

**System automatically**:
- Locks all fields at current state
- Preserves financial snapshot
- Marks as historical record

**You should**:
- Document cancellation reason
- Process any refunds (outside system)
- Note final disposition in program notes

**Cannot be undone** - this is a permanent status.

---

## Adding or Removing Items from Active Programs

### Adding Items (Common Scenario)

**Example**: Customer's lab results show they need additional support.

**Process**:
1. Navigate to program's Items tab
2. Click "Add Item"
3. Select therapy from dropdown
4. Enter quantity and instructions
5. Save

**What the system does**:
```
Before:
- Locked price: $20,000
- Current item costs: $20,000
- Variance: $0

After adding $1,500 item:
- Locked price: $20,000 (unchanged)
- Current item costs: $21,500
- Variance: -$1,500 (customer has credit)
```

**What this means**:
- Customer already paid $20,000
- We're using $1,500 from their "credit pool"
- Margin decreases (we're giving more for same price)
- Customer doesn't pay more

---

### When Variance Runs Out

If you keep adding items, eventually the variance will consume all available credit:

```
Locked price: $20,000
Added items total: $20,000
Variance: $0 (no credit left)
```

**At this point**, if you need to add more items, you have two options:

#### Option 1: Increase Discount
- Adjust the discount to bring projected price back down to locked price
- This reduces our margin further
- Customer still pays original amount

#### Option 2: Negotiate Additional Payment
- Discuss with customer about additional items needed
- Create separate invoice or payment (outside original contract)
- Document in program notes

**System will show warning** if projected costs significantly exceed locked price.

---

### Removing Items

**When you remove items** from an Active program:

```
Before removal:
- Locked price: $20,000
- Current item costs: $21,500
- Variance: -$1,500

After removing $1,000 item:
- Locked price: $20,000 (unchanged)
- Current item costs: $20,500
- Variance: -$500 (less credit used)
```

**What this means**:
- Customer still paid $20,000
- We're now delivering less
- Variance decreased (more "credit" available)
- Margin increased (better for us)

---

## Understanding Program Margin

### Why Margin Matters

Margin tells us how profitable a program is. It's the percentage of the price that remains as profit after covering costs.

**Good margin**: 60-80% (typical for our Level I-II programs)  
**Acceptable margin**: 40-60% (Level III-IV programs with more intensive care)  
**Warning margin**: Below 40% (review with management)

---

### How Margin Changes Through Program Lifecycle

#### Stage 1: Quote (Projected Margin)
```
Items total: $15,000 cost / $25,000 charge
Projected Margin: 40%
```
- This is an estimate
- Changes as you adjust the quote
- Used for proposal decisions

---

#### Stage 2: Active (Contracted Margin - Locked)
```
Customer pays: $23,000 (after discount)
Our cost: $15,000
Contracted Margin: 34.8%
```
- This becomes the baseline
- Recorded when program goes Active
- Used to measure program success

---

#### Stage 3: Active with Added Items (Current Margin)
```
Customer paid: $23,000 (locked)
Current item costs: $18,000 (added more items)
Current Margin: 21.7%
Contracted Margin: 34.8% (still shown for reference)
```

**The system tracks both**:
- **Contracted margin**: What we expected to make
- **Current margin**: What we're actually making

**This helps you see**:
- How much profit was reduced by adding items
- Whether we're staying within acceptable margins
- When to discuss additional payment with customer

---

### Margin Business Rules

The system enforces these rules:

1. **Margin cannot be negative**
   - System shows 0% minimum
   - Alerts if margin drops below thresholds

2. **For Active programs, margin is calculated on locked price**
   - Not on projected price
   - Ensures accurate profitability tracking

3. **Margin is calculated after removing taxes**
   - Taxes are pass-through (not our revenue)
   - Margin = (Price - Taxes - Cost) / (Price - Taxes)

4. **Negative finance charges increase cost**
   - Processing fees reduce our profit
   - Positive finance charges increase revenue

---

## Common Scenarios

### Scenario 1: Creating a Standard Quote

**Steps**:
1. Go to Programs → New Program
2. Select customer (lead)
3. Choose program template (e.g., "Level II Ladder to Thrive")
4. System populates items from template
5. Review pricing:
   - Total charge: $18,500
   - Taxes: $1,526.25
   - Total: $20,026.25
   - Margin: 62%
6. Apply any discounts if needed
7. Save as Quote status
8. Generate quote document for customer

**Result**: Customer receives proposal for $20,026.25 (or less with discount)

---

### Scenario 2: Converting Quote to Active Program

**Steps**:
1. Customer agrees and makes first payment
2. Record payment in system
3. Select Financing Type (e.g., "12-Month Payment Plan")
4. Change status from Quote → Active
5. System locks the price and margin
6. Set up payment schedule
7. Generate program schedule

**Result**: Program is now Active with locked pricing

---

### Scenario 3: Adding Items After Lab Results (Active Program)

**Situation**: Customer's lab work shows Vitamin D deficiency, need to add supplements.

**Steps**:
1. Open Active program
2. Go to Items tab
3. Add "Vitamin D3 5000IU" (cost: $35, charge: $80, qty: 90 days)
4. Save

**System calculates**:
```
Before:
- Locked price: $20,026.25
- Items cost: $18,500
- Variance: $0

After:
- Locked price: $20,026.25 (unchanged)
- Items cost: $18,580
- Variance: -$80 (customer has credit)
- Margin: Updated based on new cost
```

**Result**: Item added without customer paying more, using variance credit

---

### Scenario 4: Customer Requests Temporary Pause

**Situation**: Customer traveling for 6 weeks, wants to pause program.

**Steps**:
1. Open Active program
2. Change status: Active → Paused
3. Add note: "Customer traveling 6 weeks, resume mid-December"
4. Notify customer of pause terms

**System preserves**:
- Locked price
- Contracted margin
- Variance
- Payment history

**Result**: Program paused but financially intact, can resume later

---

### Scenario 5: Program Completion

**Situation**: Customer successfully completed all program components.

**Steps**:
1. Verify all items delivered
2. Confirm all payments received
3. Review final variance (should be reasonable)
4. Change status: Active → Completed
5. Add completion notes
6. Generate completion certificate (if applicable)

**System locks**:
- All financial fields
- All program data
- Historical record created

**Result**: Program marked complete, ready for analysis and reporting

---

### Scenario 6: Variance Runs Out, Need More Items

**Situation**: Active program has variance of -$200, but customer needs $500 more in items.

**Options**:

#### Option A: Increase Discount (Absorb Cost)
1. Go to Finances tab
2. Adjust discount by -$300 more
3. This allows adding items without exceeding locked price
4. Our margin decreases
5. Add the needed items

**Result**: We provide more for same price, reduced margin

#### Option B: Negotiate Additional Payment
1. Document needed items and cost ($500)
2. Discuss with customer: "Lab results show additional support needed"
3. Customer agrees to pay $500 more
4. Create separate payment record
5. Add note documenting agreement
6. Add the items

**Result**: Customer pays more, margin maintained

---

## Frequently Asked Questions

### Q: Why can't I change an Active program back to Quote?
**A**: Once a program is Active, the customer has committed and paid. Going back to Quote would break the financial lock and could cause pricing discrepancies. This protects both you and the customer by maintaining the contracted agreement.

---

### Q: What's the difference between variance and discount?
**A**: 
- **Discount**: A price reduction you offer when creating the quote (before customer pays)
- **Variance**: The difference between what customer paid and current item costs (after program is Active)

Think of variance as a "credit pool" that tracks how much buffer you have to add items without asking customer for more money.

---

### Q: Can I delete an item from an Active program?
**A**: Yes, but be careful:
- Locked price doesn't change (customer paid that amount)
- Removing items increases your margin (you deliver less for same price)
- Increases variance (more credit available)
- Consider if customer should receive partial refund (handle outside system)

---

### Q: What happens to margin when I add items to Active program?
**A**: 
- Your contracted margin (what you locked in) stays the same for reference
- Your current margin decreases because cost increased but revenue didn't
- System shows both so you can see the impact
- If margin gets too low, consider Option B in Scenario 6

---

### Q: How do I handle price adjustments for financial hardship?
**A**: 
- **Before Active**: Simply increase the discount in Finances tab
- **After Active**: You can increase discount, but this affects variance
  - Customer already paid the locked price
  - Increasing discount means you're providing more value for same money
  - Margin will decrease
  - Document reason in notes

---

### Q: Why do I need to select a Financing Type before going Active?
**A**: The system requires this to:
- Track how customer is paying
- Set up appropriate payment schedules
- Report on payment method performance
- Ensure proper financial tracking

You must select one of: Cash, Payment Plan, Insurance, or other configured options.

---

### Q: What's the difference between Total Charge and Final Total Price?
**A**: 
- **Total Charge**: Sum of all therapy item charges (base price)
- **Final Total Price**: What customer actually pays (includes taxes, discounts, finance charges)

Example:
```
Total Charge: $20,000
Taxes: +$1,650
Discounts: -$2,000
Final Total Price: $19,650
```

---

### Q: Can I edit program items while in Quote status?
**A**: Yes! While in Quote status, everything is flexible:
- Add or remove items freely
- Adjust quantities
- Change pricing (if you have permissions)
- Modify discounts
- All calculations update automatically

Once you go Active, you can still edit, but it affects variance and margin.

---

### Q: What should I do if projected price exceeds locked price by a lot?
**A**: This means variance is large and you've added significant items. Options:
1. Review items - are they all necessary?
2. Increase discount to bring projected price down to locked price
3. Discuss with customer about additional payment
4. Escalate to management for review

The system will show warnings when variance becomes significant.

---

### Q: How do I see program profitability?
**A**: Open any program and look at the Finances tab:
- **Projected Margin** (for Quotes): Expected profitability
- **Contracted Margin** (for Active): What you locked in
- **Current Margin** (for Active): Actual profitability now
- **Variance**: How much customer credit is being used

The Admin → Program Audit page also shows profitability across all programs.

---

### Q: Can I change the locked price after a program is Active?
**A**: No, the locked price cannot be directly changed. This is intentional. However:
- You can add discounts (effectively reduces what you're making)
- You can adjust finance charges
- These affect the variance and margin calculations
- The locked price field itself remains unchanged

If a significant price change is needed, document it thoroughly and consult management.

---

### Q: What happens to scheduled items when I pause a program?
**A**: 
- Existing schedule items remain
- No new schedule items are automatically generated
- Program appears in "Paused Programs" report
- When you change back to Active, scheduling resumes

---

### Q: How are taxes calculated when I apply a discount?
**A**: The system is smart about this:
1. Identifies which items are taxable
2. Calculates what percentage of total charge is taxable
3. Applies that same percentage of your discount to taxable items
4. Calculates 8.25% tax on the discounted taxable amount

Example:
```
Total charge: $10,000 (60% is taxable = $6,000)
Discount: -$2,000
Taxable discount portion: $1,200 (60% of discount)
Discounted taxable amount: $4,800
Tax: $396 (8.25% of $4,800)
```

This ensures taxes are always correct and proportional.

---

## Need Help?

### For Questions About:
- **Status transitions**: Contact your supervisor
- **Pricing decisions**: Contact sales management
- **System issues**: Contact IT support
- **Financial discrepancies**: Contact accounting

### Additional Resources:
- Program Templates User Guide
- Payment Processing Guide
- GHL Integration Guide (for lead management)

---

**Document Version**: 1.0  
**Maintained By**: Development Team  
**Last Review**: October 23, 2025

