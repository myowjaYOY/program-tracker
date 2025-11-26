# Inventory Management Tab - Design Specification

## Executive Summary
This document outlines the design for a comprehensive Inventory Management tab that enables inventory specialists to track stock levels, perform physical counts, reconcile variances, and manage reorder processes efficiently.

---

## 🎯 **Primary User Goals**

1. **View current inventory** across all tracked therapies
2. **Perform physical counts** (cycle counting & full physical inventory)
3. **Reconcile variances** between system vs. physical counts
4. **Track inventory movements** (receipts, dispensing, adjustments)
5. **Manage reorder** points and quantities
6. **Monitor low-stock alerts**

---

## 📊 **Page Layout - Tab Structure**

### Tab 1: **Inventory Dashboard** (Landing Page)
Quick overview with key metrics and alerts

### Tab 2: **Physical Count** (NEW)
Dedicated interface for performing inventory counts

### Tab 3: **Transaction History** (Audit Trail)
Complete history of all inventory movements

### Tab 4: **Reorder Management**
Items needing reorder and purchase order workflow

---

## 🏗️ **DESIGN SPECIFICATION**

---

## **TAB 1: INVENTORY DASHBOARD**

### **Purpose**
Central view of all inventory items with real-time status and quick actions

### **Layout**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ INVENTORY DASHBOARD                                         [+ Add Item] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Summary Cards (Row 1)                                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │ Total Items  │ │  Low Stock   │ │  Out of      │ │ Last Count   │  │
│  │             │ │              │ │  Stock       │ │              │  │
│  │     93      │ │   🟡 12      │ │   🔴 3       │ │  2 days ago  │  │
│  │   tracked   │ │   items      │ │   items      │ │  (85% done)  │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 🔍 Search: [_____________]  Filters: [Status ▾] [Category ▾]   │   │
│  │    [Low Stock Only] ☐  [Never Counted] ☐  [📅 Last Count Date]│   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  Data Grid (MUI DataGrid Pro)                                            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │Item Name          │Category │On Hand│Reorder│Last Count│Actions │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │Balance (60ct)     │Suppl.   │  45   │  20   │2d ago    │[Count] │  │
│  │                   │         │       │       │          │[Adj]   │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │InosiCare (30serv) │Suppl.   │   8 🟡│  15   │5d ago    │[Count] │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │Reacted Iron (60ct)│Suppl.   │   0 🔴│  10   │Never     │[Count] │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │Energy Enhancer    │Suppl.   │  32   │  25   │1d ago    │[Count] │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                  [1-25 of 93]  [< 1 2 3 4 >]            │
└─────────────────────────────────────────────────────────────────────────┘
```

### **Data Grid Columns**

| Column | Type | Sort | Filter | Description |
|--------|------|------|--------|-------------|
| Item Name | Text | ✅ | ✅ | Therapy name + unit size |
| Category | Badge | ✅ | ✅ | Therapy type (Supplement, Lab, etc.) |
| On Hand | Number | ✅ | ✅ | Current quantity (color-coded) |
| Reorder Point | Number | ✅ | ❌ | Threshold for reorder alerts |
| Last Counted | Date | ✅ | ✅ | Last physical count date |
| Status | Badge | ✅ | ✅ | OK, Low Stock, Out of Stock |
| Actions | Buttons | ❌ | ❌ | Quick actions |

### **Color Coding (Visual Indicators)**

| Status | Color | Condition | Icon |
|--------|-------|-----------|------|
| OK | 🟢 Green | `on_hand > reorder_point` | ✓ |
| Low Stock | 🟡 Yellow | `on_hand <= reorder_point` | ⚠ |
| Out of Stock | 🔴 Red | `on_hand = 0` | ⚫ |
| Never Counted | ⚪ Gray | `last_counted_at IS NULL` | ⊘ |

### **Quick Actions**

| Button | Action | Opens |
|--------|--------|-------|
| **[Count]** | Perform physical count | Count modal |
| **[Adj]** | Manual adjustment | Adjustment modal |
| **[Details]** | View full history | Detail drawer |

---

## **TAB 2: PHYSICAL COUNT** (NEW TAB)

### **Purpose**
Streamlined interface for inventory specialists to perform physical counts and reconcile variances

### **Best Practice: Cycle Counting**
- Count 20% of items per week (complete inventory every 5 weeks)
- Prioritize high-value, fast-moving, or low-stock items
- Schedule counts during low-activity periods

### **Layout - Count Session**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PHYSICAL COUNT SESSION                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Session Info                                                     │   │
│  │ Count Date: [11/04/2025] ✓    Counter: [John Smith]            │   │
│  │ Count Type: [○ Cycle Count  ● Full Inventory]                   │   │
│  │ Status: IN PROGRESS    Progress: [████████░░] 23 of 93 (25%)   │   │
│  │                                                                  │   │
│  │ [Save Progress] [Complete Session] [Cancel]                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Scanning / Manual Entry                                          │   │
│  │                                                                  │   │
│  │ 🔍 Scan Barcode or Search Item:                                │   │
│  │ [___________________________________________] [🔍 Search]        │   │
│  │                                                                  │   │
│  │ OR select from list below:                                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  Items to Count                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │Item Name          │Expected│Physical│Variance│Status   │Actions │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │Balance (60ct)     │  45    │  44    │  -1    │✓ Counted│[Edit]  │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │InosiCare (30serv) │   8    │ [____] │   -    │Pending  │[Count] │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │Reacted Iron (60ct)│   0    │   5    │  +5    │✓ Counted│[Edit]  │  │
│  │                   │        │        │        │⚠Variance│        │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │Energy Enhancer    │  32    │ [____] │   -    │Pending  │[Count] │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Variance Summary                                                 │   │
│  │ Items with Variance: 12    Total Adjustments: +8 / -15          │   │
│  │ Items Counted: 23          Remaining: 70                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### **Count Workflow**

```
1. START SESSION
   ↓
2. SELECT ITEMS TO COUNT
   - Full inventory (all items)
   - Cycle count (select specific items)
   - Low stock only
   - Never counted
   ↓
3. FOR EACH ITEM:
   a. Scan barcode OR select from list
   b. System shows: Item name, expected quantity
   c. User enters: Physical count
   d. System calculates: Variance
   ↓
4. VARIANCE REVIEW
   - If variance = 0: Auto-accept
   - If variance != 0: Flag for review
     - Small variance (<5%): Warning, allow quick accept
     - Large variance (≥5%): Require notes
   ↓
5. COMPLETE SESSION
   - Review all variances
   - Add session notes
   - Click "Complete & Post Adjustments"
   ↓
6. SYSTEM ACTIONS
   - Creates adjustment transactions
   - Updates quantity_on_hand
   - Updates last_counted_at
   - Logs variance report
```

### **Variance Handling**

| Variance % | Action | Required |
|------------|--------|----------|
| 0% | ✅ Auto-accept | None |
| <5% | ⚠ Warning | Optional note |
| 5-10% | ⚠⚠ Caution | Manager approval |
| >10% | 🔴 Alert | Recount + notes |

---

## **TAB 3: TRANSACTION HISTORY**

### **Purpose**
Complete audit trail of all inventory movements

### **Layout**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ TRANSACTION HISTORY                                      [Export CSV]    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Filters:                                                                │
│  Date Range: [Last 30 Days ▾]  Type: [All ▾]  Item: [Search...]        │
│  [Apply Filters]  [Clear]                                               │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │Date/Time      │Item Name       │Type        │Qty │User     │Ref  │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │11/04 10:15am  │Balance (60ct)  │Adjustment  │ -1 │J.Smith  │PC-1│  │
│  │               │                │(Count)     │    │         │    │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │11/04 09:30am  │InosiCare       │Purchase    │+20 │J.Smith  │PO-5│  │
│  │               │                │Receive     │    │         │    │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │11/03 2:15pm   │Reacted Iron    │Dispensing  │ -2 │System   │M-42│  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │11/03 11:00am  │Energy Enhancer │Adjustment  │+15 │J.Smith  │PC-1│  │
│  │               │                │(Manual)    │    │         │    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### **Transaction Types**

| Type | Description | Source | Quantity |
|------|-------------|--------|----------|
| `purchase_receive` | Received from supplier | Purchase Order | + |
| `dispensing` | Used for member program | Program Item | - |
| `adjustment` | Physical count variance | Count Session | +/- |
| `return` | Returned from member | Manual Entry | + |

---

## **TAB 4: REORDER MANAGEMENT**

### **Purpose**
Manage reorder points and create purchase orders

### **Layout**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ REORDER MANAGEMENT                              [+ New Purchase Order]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Items Needing Reorder (On Hand ≤ Reorder Point)                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │☐│Item Name       │On Hand│Reorder│Reorder Qty│Status  │Actions │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │☑│InosiCare       │   8   │  15   │    25     │🟡 Low  │[Order] │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │☑│Reacted Iron    │   0   │  10   │    30     │🔴 Out  │[Order] │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │☐│Balance (60ct)  │  18   │  20   │    40     │🟡 Low  │[Order] │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  [Create PO for Selected Items (2)]  [Update Reorder Points]            │
│                                                                           │
│  Recent Purchase Orders                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │PO Number │Date      │Supplier     │Items│Total   │Status         │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │PO-2025-05│11/01/25  │Acme Medical │  8  │$1,245  │Received       │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │PO-2025-04│10/28/25  │HealthCorp   │  5  │$  856  │Partial (3/5)  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 **TECHNICAL IMPLEMENTATION**

### **Database Changes Needed**

#### **1. Add Count Session Tracking Table** (NEW)

```sql
CREATE TABLE inventory_count_sessions (
  count_session_id SERIAL PRIMARY KEY,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  count_type VARCHAR(20) NOT NULL CHECK (count_type IN ('cycle', 'full')),
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress' 
    CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  counted_by UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  items_counted INTEGER DEFAULT 0,
  items_with_variance INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID DEFAULT auth.uid(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID DEFAULT auth.uid()
);
```

#### **2. Add Count Details Table** (NEW)

```sql
CREATE TABLE inventory_count_details (
  count_detail_id SERIAL PRIMARY KEY,
  count_session_id INTEGER REFERENCES inventory_count_sessions(count_session_id),
  inventory_item_id INTEGER REFERENCES inventory_items(inventory_item_id),
  expected_quantity INTEGER NOT NULL,
  physical_quantity INTEGER NOT NULL,
  variance INTEGER GENERATED ALWAYS AS (physical_quantity - expected_quantity) STORED,
  variance_pct NUMERIC GENERATED ALWAYS AS (
    CASE 
      WHEN expected_quantity = 0 THEN 0
      ELSE ROUND((physical_quantity - expected_quantity)::numeric / expected_quantity * 100, 2)
    END
  ) STORED,
  notes TEXT,
  requires_approval BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### **3. Update `inventory_transactions` Reference Type**

Add `count_session` as a valid reference_type:

```sql
-- Update constraint to include count_session
ALTER TABLE inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_reference_type_check;
ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transactions_reference_type_check 
  CHECK (reference_type IN ('purchase_order', 'program_item', 'count_session', 'manual_adjustment', 'return'));
```

### **API Endpoints Needed**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/inventory/items` | GET | List all inventory items with filters |
| `/api/inventory/items/[id]` | GET | Get single item details |
| `/api/inventory/items/[id]` | PUT | Update reorder points |
| `/api/inventory/count-sessions` | POST | Start new count session |
| `/api/inventory/count-sessions/[id]` | GET | Get session details |
| `/api/inventory/count-sessions/[id]` | PUT | Update session (save progress) |
| `/api/inventory/count-sessions/[id]/complete` | POST | Complete session & post adjustments |
| `/api/inventory/count-sessions/[id]/items` | POST | Add count for item |
| `/api/inventory/transactions` | GET | Get transaction history |
| `/api/inventory/transactions` | POST | Create manual adjustment |
| `/api/inventory/reorder` | GET | Get items needing reorder |

### **React Components Needed**

```
src/
├── app/
│   └── dashboard/
│       └── inventory/
│           └── page.tsx (Main page with tabs)
├── components/
│   └── inventory/
│       ├── inventory-dashboard-tab.tsx
│       ├── inventory-table.tsx (DataGrid)
│       ├── physical-count-tab.tsx
│       ├── count-session-form.tsx
│       ├── count-item-row.tsx
│       ├── transaction-history-tab.tsx
│       ├── transaction-table.tsx
│       ├── reorder-management-tab.tsx
│       ├── reorder-table.tsx
│       └── modals/
│           ├── quick-count-modal.tsx
│           ├── adjustment-modal.tsx
│           └── complete-session-modal.tsx
├── lib/
│   ├── hooks/
│   │   ├── use-inventory-items.ts
│   │   ├── use-count-sessions.ts
│   │   └── use-inventory-transactions.ts
│   └── validations/
│       ├── inventory-count.ts
│       └── inventory-adjustment.ts
```

---

## 📱 **USER WORKFLOWS**

### **Workflow 1: Daily Cycle Count**

```
1. Navigate to Inventory > Physical Count tab
2. Click "Start New Count Session"
3. Select "Cycle Count"
4. System suggests 20% of items (sorted by: never counted, low stock, high-value)
5. User scans/selects first item
6. Enter physical count
7. System shows variance (if any)
8. If variance < 5%: Accept and continue
9. If variance ≥ 5%: Add notes, recount if needed
10. Repeat for all items
11. Click "Complete Session"
12. Review variance summary
13. Click "Post Adjustments"
14. System creates transactions and updates inventory
```

### **Workflow 2: Manual Adjustment**

```
1. Navigate to Inventory > Dashboard tab
2. Find item needing adjustment
3. Click [Adj] button
4. Modal opens:
   - Current quantity: 45
   - New quantity: [___] OR Adjustment: [+/-___]
   - Reason: [Dropdown: Damaged, Expired, Found, Other]
   - Notes: [_____]
5. Click "Save Adjustment"
6. System creates adjustment transaction
7. Updates quantity_on_hand
8. Shows success toast
```

### **Workflow 3: Receiving Inventory from PO**

```
1. Navigate to Inventory > Reorder Management
2. Find Purchase Order in "Recent POs"
3. Click PO to view details
4. For each item:
   - Check "Received" ✓
   - Enter quantity received (defaults to ordered qty)
   - Enter received date
5. Click "Post Receipt"
6. System:
   - Creates "purchase_receive" transaction
   - Updates quantity_on_hand
   - Updates PO status
   - Updates last_counted_at (since we physically verified)
```

---

## 🎨 **UI/UX BEST PRACTICES**

### **Color-Coded Visual Indicators**
- 🟢 Green: Healthy stock levels
- 🟡 Yellow: Low stock warning
- 🔴 Red: Out of stock/critical
- ⚪ Gray: Never counted/unknown

### **Keyboard Shortcuts** (for power users)
- `Alt+C`: Start count session
- `Alt+A`: Add adjustment
- `/`: Focus search
- `Enter`: Quick save on count entry
- `Esc`: Cancel/close modal

### **Mobile-Friendly**
- Large touch targets for count entry
- Barcode scanner integration on mobile devices
- Simplified mobile view (essential columns only)

### **Real-Time Updates**
- Show live updates when other users make changes
- Display "Last updated X seconds ago"
- Auto-refresh every 60 seconds

### **Export Capabilities**
- Export transaction history to CSV/Excel
- Export variance reports
- Export current inventory snapshot

---

## 📊 **REPORTING & ANALYTICS**

### **Key Reports to Build**

1. **Inventory Valuation Report**
   - Total inventory value (qty × unit cost)
   - By category/supplier
   - Trend over time

2. **Variance Report**
   - Total variances by period
   - Top items with variances
   - Accuracy metrics (% items with 0 variance)

3. **Turnover Report**
   - Items by usage frequency
   - Slow-moving items (candidates for discontinuation)
   - Fast-moving items (candidates for higher reorder points)

4. **Count Compliance Report**
   - % of items counted in last 30 days
   - Items never counted
   - Average time between counts

---

## 🔐 **PERMISSIONS & SECURITY**

### **Role-Based Access**

| Role | Dashboard | Count | Adjust | Reorder | View Transactions |
|------|-----------|-------|--------|---------|-------------------|
| Admin | ✅ Full | ✅ All | ✅ All | ✅ All | ✅ All |
| Inventory Manager | ✅ Full | ✅ All | ✅ All | ✅ All | ✅ All |
| Inventory Specialist | ✅ View | ✅ Count | ✅ <$100 | ❌ View only | ✅ Own |
| Provider | ✅ View | ❌ No | ❌ No | ❌ No | ❌ No |

### **Audit Requirements**
- All adjustments logged with user ID and timestamp
- Large variances require manager approval
- All count sessions archived (never deleted)
- Transaction history immutable

---

## 🚀 **IMPLEMENTATION PHASES**

### **Phase 1: Foundation** (Week 1)
- ✅ Create database tables (count_sessions, count_details)
- ✅ Build basic API endpoints
- ✅ Create Inventory Dashboard tab (read-only)
- ✅ Display current inventory with filters

### **Phase 2: Core Counting** (Week 2)
- ✅ Build Physical Count tab
- ✅ Implement count session workflow
- ✅ Variance calculation and display
- ✅ Post adjustments functionality

### **Phase 3: Adjustments & History** (Week 3)
- ✅ Manual adjustment modal
- ✅ Transaction history tab
- ✅ Quick actions (Count, Adjust buttons)
- ✅ Filters and search

### **Phase 4: Reorder & Polish** (Week 4)
- ✅ Reorder Management tab
- ✅ Low stock alerts
- ✅ Export functionality
- ✅ Mobile optimization
- ✅ User training & documentation

---

## 📋 **SUCCESS METRICS**

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Count Frequency | 100% of items counted monthly | `inventory_items.last_counted_at` |
| Count Accuracy | >95% items with <5% variance | Variance % from count sessions |
| Time per Count | <2 minutes per item | Count session duration / items |
| Stockouts | <2% of items out of stock | Daily snapshot of items with qty=0 |
| User Adoption | 100% of inventory specialists | Active count sessions per user |

---

## 🎯 **NEXT STEPS**

1. **Review this design** with inventory specialists (15 mins)
2. **Get stakeholder approval** on workflows (30 mins)
3. **Start Phase 1 implementation** (Begin database schema)
4. **Build prototype** of Physical Count tab for user testing
5. **Iterate based on feedback**

---

**Questions for Stakeholders:**

1. What % of inventory should we count per cycle? (Recommended: 20% weekly = 100% monthly)
2. Who can approve large variances? (Manager? Admin only?)
3. Do you want barcode scanning capability? (Requires hardware)
4. Should we integrate with existing POS or ordering systems?
5. What reports are most critical for your team?

---

**This design balances:**
- ✅ Industry best practices (cycle counting, variance management)
- ✅ User experience (streamlined workflows, visual indicators)
- ✅ Data integrity (audit trails, approval workflows)
- ✅ Scalability (handles 1000s of items efficiently)
- ✅ Your existing schema (minimal changes needed)

**Ready to build!** 🚀




















