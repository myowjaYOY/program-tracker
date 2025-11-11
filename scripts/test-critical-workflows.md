# Critical Workflow Testing

**Purpose:** Verify these workflows still work after ANY database change.

---

## 🧪 **Test Suite**

### 1. Coordinator Script - Redeem/Miss Items
**What it tests:** Schedule updates, inventory transactions trigger

**Steps:**
1. Navigate to `/coordinator`
2. Click on Script tab
3. Find any "Pending" item
4. Click the status chip to mark as "Redeemed"
5. Verify it changes to green "Redeemed" chip
6. Check Network tab - should be 200 status
7. Refresh page - status should persist

**Database Check:**
```sql
-- Verify inventory transaction was created
SELECT * FROM inventory_transactions 
WHERE reference_type = 'member_program_item_schedule'
ORDER BY transaction_date DESC 
LIMIT 5;
```

---

### 2. Purchase Order Receipt
**What it tests:** Inventory item updates, transaction logging

**Steps:**
1. Navigate to `/dashboard/inventory-management`
2. Go to Purchase Orders tab
3. Find any "Ordered" PO
4. Click "Receive Items"
5. Enter received quantities
6. Save
7. Verify inventory quantities updated

**Database Check:**
```sql
-- Verify inventory updated correctly
SELECT 
  ii.inventory_item_id,
  ii.quantity_on_hand,
  t.therapy_name
FROM inventory_items ii
JOIN therapies t ON ii.therapy_id = t.therapy_id
ORDER BY ii.updated_at DESC
LIMIT 5;
```

---

### 3. Program Financial Updates
**What it tests:** Program finances calculations, margin updates

**Steps:**
1. Navigate to any member program
2. Go to Financials tab
3. Update any financial value (taxes, finance charges, etc.)
4. Save
5. Verify calculations update correctly
6. Check program price and margin

---

### 4. Therapy Creation with Inventory Tracking
**What it tests:** Therapy → Inventory item linking

**Steps:**
1. Navigate to `/dashboard/therapies`
2. Click "Add Therapy"
3. Fill in all required fields
4. Check "Track in Inventory"
5. Save
6. Verify therapy created
7. Verify inventory item created

**Database Check:**
```sql
-- Verify inventory item was created
SELECT 
  t.therapy_id,
  t.therapy_name,
  ii.inventory_item_id,
  ii.quantity_on_hand
FROM therapies t
LEFT JOIN inventory_items ii ON t.therapy_id = ii.therapy_id
WHERE t.therapy_name = 'YOUR_TEST_THERAPY'
ORDER BY t.created_at DESC
LIMIT 1;
```

---

### 5. Program Status Changes
**What it tests:** Status transitions, readonly enforcement

**Steps:**
1. Navigate to any "Active" program
2. Change status to "Completed"
3. Verify all tabs become readonly
4. Verify warning banner appears
5. Try to edit something - should be blocked

---

## 🤖 **Automated Test Script (Future)**

```typescript
// scripts/test-critical-workflows.ts
// Run with: npx tsx scripts/test-critical-workflows.ts

import { createClient } from '@supabase/supabase-js';

async function testCoordinatorRedeem() {
  // Test schedule update
  console.log('Testing Coordinator Redeem...');
  // ... implement test
}

async function testPurchaseOrderReceipt() {
  // Test PO receipt
  console.log('Testing PO Receipt...');
  // ... implement test
}

async function runAllTests() {
  console.log('🧪 Running Critical Workflow Tests\n');
  
  await testCoordinatorRedeem();
  await testPurchaseOrderReceipt();
  // ... more tests
  
  console.log('\n✅ All tests passed!');
}

runAllTests().catch(console.error);
```

---

## ⚠️ **When to Run**

Run this test suite:
- ✅ After ANY database migration
- ✅ Before deploying to production
- ✅ After major code changes
- ✅ Weekly as regression test

**Time Required:** ~10 minutes manual testing

**Goal:** Catch breaking changes BEFORE production














