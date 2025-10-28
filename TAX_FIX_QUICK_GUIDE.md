# Tax Data Fix - Quick Execution Guide

**Date**: October 27, 2025  
**Estimated Time**: 30 minutes  
**Risk Level**: Very Low ✅

---

## The Strategy in 3 Bullets

1. **Recalculate taxes** from current items (for all programs)
2. **Respect locked values** (contracted_at_margin, final_total_price for Active programs)
3. **Update dependent fields** (variance, margin) based on locked values

---

## Before You Start

### Prerequisites
- [ ] Database access (MCP or SQL client)
- [ ] `scripts/fix-corrupted-taxes.sql` file available
- [ ] 30 minutes of uninterrupted time
- [ ] Low-traffic period (optional but recommended)

---

## Execution Steps

### 1️⃣ Preview (5 minutes)

**Run this query** from `fix-corrupted-taxes.sql`:
```sql
-- Copy and run Step 1 from the script
```

**What you'll see**:
- List of programs with incorrect taxes
- Current vs. correct tax amounts
- Tax difference for each program
- Locked values (for Active programs)

**Verify**:
- ✅ Correct taxes look reasonable
- ✅ Locked values exist for Active programs
- ✅ Differences match your expectations

---

### 2️⃣ Backup (1 minute) - **CRITICAL!**

**Run this query**:
```sql
CREATE TABLE member_program_finances_backup_20251027 AS
SELECT * FROM member_program_finances;

-- Verify backup created
SELECT COUNT(*) as backup_row_count 
FROM member_program_finances_backup_20251027;
```

**Expected**: Row count = total number of programs with finances

---

### 3️⃣ Fix Quote Programs (1 minute)

**Run Step 3A** from `fix-corrupted-taxes.sql`

**What it does**: Recalculates taxes, margin, and price for Quote programs

**Expected output**: `X programs_fixed`

---

### 4️⃣ Fix Active Programs (1 minute)

**Run Step 3B** from `fix-corrupted-taxes.sql`

**What it does**: 
- Recalculates taxes
- Updates variance and margin
- **Preserves** contracted_at_margin and final_total_price

**Expected output**: `Y programs_fixed`

---

### 5️⃣ Fix Other Status Programs (1 minute)

**Run Step 3C** from `fix-corrupted-taxes.sql`

**What it does**: Same as Active programs

**Expected output**: `Z programs_fixed`

---

### 6️⃣ Verify Success (10 minutes)

#### A. Check for Remaining Discrepancies
**Run Step 4A** from script

**Expected**: ZERO rows (no discrepancies remaining)

#### B. Verify Locked Values Preserved
**Run Step 4B** from script

**Expected**: All rows show `✅ LOCKED VALUES PRESERVED`

#### C. Summary of Changes
**Run Step 4C** from script

**Expected**: Shows count and average tax change by status

---

### 7️⃣ Application Audit Report (5 minutes)

1. Open application
2. Go to **Admin → Program Audit**
3. Review audit report

**Expected**: ZERO programs with tax discrepancies

---

### 8️⃣ Manual Spot Check (7 minutes)

Pick 3-5 programs (mix of Quote and Active) and verify:

**For Quote Programs**:
- [ ] Taxes = (TotalTaxableCharge - TaxableDiscount) × 0.0825
- [ ] Margin calculated on projected price
- [ ] Price = TotalCharge + Taxes + FinanceCharges - Discounts

**For Active Programs**:
- [ ] Taxes = (TotalTaxableCharge - TaxableDiscount) × 0.0825
- [ ] contracted_at_margin = [same as before]
- [ ] final_total_price = [same as before]
- [ ] variance = ProjectedPrice - LockedPrice
- [ ] margin = ((LockedPrice - TotalCost) / LockedPrice) × 100

---

## If Something Goes Wrong

### 🚨 Rollback (10 seconds)

```sql
UPDATE member_program_finances mpf
SET 
  taxes = bkp.taxes,
  margin = bkp.margin,
  variance = bkp.variance,
  final_total_price = bkp.final_total_price,
  contracted_at_margin = bkp.contracted_at_margin,
  updated_at = bkp.updated_at
FROM member_program_finances_backup_20251027 bkp
WHERE mpf.member_program_id = bkp.member_program_id;
```

---

## Success Checklist

- [ ] Step 1 preview completed and reviewed
- [ ] Backup created (Step 2)
- [ ] Quote programs fixed (Step 3A)
- [ ] Active programs fixed (Step 3B)
- [ ] Other programs fixed (Step 3C)
- [ ] Zero discrepancies remain (Step 4A)
- [ ] Locked values preserved (Step 4B)
- [ ] Changes summary reviewed (Step 4C)
- [ ] Audit report shows zero issues
- [ ] Manual spot check passed
- [ ] No user-reported issues

---

## Quick Reference: What Changes

| Field | Quote Programs | Active Programs |
|-------|----------------|-----------------|
| **taxes** | ✅ Recalculated | ✅ Recalculated |
| **margin** | ✅ Recalculated (on projected price) | ✅ Recalculated (on locked price) |
| **variance** | ✅ N/A (not used) | ✅ Recalculated |
| **final_total_price** | ✅ Recalculated | 🔒 LOCKED (no change) |
| **contracted_at_margin** | ✅ N/A (not set) | 🔒 LOCKED (no change) |

---

## After Completion

**Keep backup table** for 30 days:
```sql
-- After 30 days, if all is well:
DROP TABLE member_program_finances_backup_20251027;
```

**Monitor**: Check audit report daily for first week

---

## Questions While Executing?

1. **Preview shows unexpected results?** 
   → STOP. Review manually before proceeding.

2. **Locked values changed?**
   → ROLLBACK immediately. Investigate Step 3B/3C.

3. **Still see discrepancies after fix?**
   → Check Step 4A results. May need to investigate edge cases.

4. **User reports incorrect numbers?**
   → Check that specific program. Compare with backup.

---

## Files Reference

- **Script**: `scripts/fix-corrupted-taxes.sql`
- **Strategy**: `TAX_DATA_CLEANUP_STRATEGY.md` (detailed explanation)
- **Root Cause**: `AUDIT_TAX_DISCREPANCY_ROOT_CAUSE_AND_FIX.md`

---

**Ready? Let's fix this! 🚀**


