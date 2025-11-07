# Physical Count Tab - Integration Design

## Overview
This design integrates the Physical Count functionality into the existing Inventory Management page's **Tab 3: "Inventory"**.

---

## 🏗️ **EXISTING STRUCTURE** (Keep As-Is)

```
Inventory Management Page
├── 4 Metric Cards (PO-focused)
│   ├── Pending Approval
│   ├── Awaiting Receipt  
│   ├── Open PO Value
│   └── Low Stock Items ✓ (already inventory-focused)
├── Tab 1: Purchase Orders ✓
├── Tab 2: Ordered Items (placeholder)
└── Tab 3: Inventory (IMPLEMENT HERE) ⭐
```

---

## 📊 **ENHANCED METRIC CARDS**

### Recommendation: Add 4 More Cards (Total: 8 cards, 2 rows)

**Row 1: Purchase Order Metrics** (existing)
- Pending Approval
- Awaiting Receipt
- Open PO Value
- Low Stock Items

**Row 2: Inventory Health Metrics** (NEW)

```tsx
<Grid container spacing={3} sx={{ mb: 3 }}>
  {/* Card 5: Total Items Tracked */}
  <Grid size={3}>
    <Card borderTop="primary.main">
      <CardContent>
        <Typography>Total Items</Typography>
        <Typography variant="h3" color="primary.main">
          {metrics?.total_tracked_items || 0}
        </Typography>
        <Typography variant="caption">Tracked in Inventory</Typography>
      </CardContent>
    </Card>
  </Grid>

  {/* Card 6: Out of Stock */}
  <Grid size={3}>
    <Card borderTop="error.main">
      <CardContent>
        <Typography>Out of Stock</Typography>
        <Typography variant="h3" color="error.main">
          {metrics?.out_of_stock_count || 0}
        </Typography>
        <Typography variant="caption">Quantity = 0</Typography>
      </CardContent>
    </Card>
  </Grid>

  {/* Card 7: Last Count Status */}
  <Grid size={3}>
    <Card borderTop="warning.main">
      <CardContent>
        <Typography>Last Count</Typography>
        <Typography variant="h3" color="warning.main">
          {metrics?.days_since_last_count || '--'} days
        </Typography>
        <Typography variant="caption">
          {metrics?.count_completion_pct || 0}% Complete
        </Typography>
      </CardContent>
    </Card>
  </Grid>

  {/* Card 8: Never Counted */}
  <Grid size={3}>
    <Card borderTop="grey.500">
      <CardContent>
        <Typography>Never Counted</Typography>
        <Typography variant="h3" color="text.secondary">
          {metrics?.never_counted_count || 0}
        </Typography>
        <Typography variant="caption">Need Initial Count</Typography>
      </CardContent>
    </Card>
  </Grid>
</Grid>
```

---

## 🎯 **TAB 3: INVENTORY - FULL IMPLEMENTATION**

### **Sub-Tab Structure** (2 sub-tabs within Tab 3)

```
Tab 3: Inventory
├── Sub-Tab A: Inventory Items (view-only list)
└── Sub-Tab B: Physical Count ⭐ (count workflow)
```

---

## **SUB-TAB A: INVENTORY ITEMS** (Simple View)

### Purpose
Quick reference list of all tracked inventory items with current status

### Layout

```tsx
┌─────────────────────────────────────────────────────────────────┐
│ INVENTORY ITEMS                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🔍 Search: [____________]  Filters: [Status ▾] [Category ▾]   │
│  [☐ Low Stock Only]  [☐ Never Counted]  [☐ Out of Stock]       │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │Item Name          │Category│On Hand│Reorder│Last Count   │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │Balance (60ct)     │Suppl.  │  45  │  20   │2 days ago   │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │InosiCare (30serv) │Suppl.  │   8🟡│  15   │5 days ago   │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │Reacted Iron (60ct)│Suppl.  │   0🔴│  10   │Never        │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │Energy Enhancer    │Suppl.  │  32  │  25   │1 day ago    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                         [1-25 of 93]  [< 1 2 >] │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation

```tsx
// src/components/inventory/inventory-items-tab.tsx
export default function InventoryItemsTab() {
  const { data: items, isLoading } = useInventoryItems();

  return (
    <Box>
      {/* Filters */}
      <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
        <TextField 
          placeholder="Search items..."
          size="small"
          InputProps={{
            startAdornment: <SearchIcon />
          }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select label="Status">
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="ok">OK</MenuItem>
            <MenuItem value="low">Low Stock</MenuItem>
            <MenuItem value="out">Out of Stock</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Data Grid */}
      <DataGrid 
        rows={items || []}
        columns={[
          { field: 'therapy_name', headerName: 'Item Name', flex: 1 },
          { field: 'therapy_type_name', headerName: 'Category', width: 120 },
          { 
            field: 'quantity_on_hand', 
            headerName: 'On Hand', 
            width: 100,
            renderCell: (params) => (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {params.value}
                {getStatusIcon(params.row)}
              </Box>
            )
          },
          { field: 'reorder_point', headerName: 'Reorder', width: 100 },
          { 
            field: 'last_counted_at', 
            headerName: 'Last Count', 
            width: 150,
            valueGetter: (params) => 
              params.value ? formatDistanceToNow(new Date(params.value)) : 'Never'
          },
        ]}
        pageSize={25}
        autoHeight
        disableRowSelectionOnClick
      />
    </Box>
  );
}

function getStatusIcon(row) {
  if (row.quantity_on_hand === 0) return <ErrorIcon color="error" />;
  if (row.quantity_on_hand <= row.reorder_point) return <WarningIcon color="warning" />;
  return <CheckCircleIcon color="success" />;
}
```

---

## **SUB-TAB B: PHYSICAL COUNT** ⭐ (Core Feature)

### Purpose
Streamlined workflow for inventory specialists to perform physical counts and reconcile variances

### Layout - Main Screen

```tsx
┌─────────────────────────────────────────────────────────────────┐
│ PHYSICAL COUNT                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Active Count Session                                     │   │
│  │                                                          │   │
│  │ Session: #PC-2025-11-04-001                             │   │
│  │ Started: 11/04/2025 9:30 AM by John Smith              │   │
│  │ Type: Cycle Count (20% of items)                        │   │
│  │                                                          │   │
│  │ Progress: [████████░░░░] 15 of 93 items (16%)          │   │
│  │                                                          │   │
│  │ [Continue Count]  [Complete Session]  [Cancel]          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                     OR                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ No Active Session                                        │   │
│  │                                                          │   │
│  │ [+ Start New Count Session]                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Recent Count Sessions                                           │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │Session ID    │Date      │Type  │Items│Status    │Actions  │ │
│  ├────────────────────────────────────────────────────────────┤ │
│  │PC-2025-11-03 │11/03/25  │Cycle │ 18  │Completed │[View]   │ │
│  │PC-2025-11-01 │11/01/25  │Full  │ 93  │Completed │[View]   │ │
│  │PC-2025-10-30 │10/30/25  │Cycle │ 20  │Completed │[View]   │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

### **WORKFLOW: Start New Count Session**

#### Step 1: Click "Start New Count Session" Button

Opens modal:

```tsx
┌──────────────────────────────────────────────────────┐
│ Start New Count Session                              │
├──────────────────────────────────────────────────────┤
│                                                       │
│  Count Type:                                         │
│  ● Cycle Count (Recommended - 20% of items)          │
│  ○ Full Physical Inventory (All items)               │
│  ○ Custom Selection                                   │
│                                                       │
│  ──────────────────────────────────────────────────  │
│                                                       │
│  Cycle Count Strategy: [Smart Selection ▾]           │
│  • Prioritize: Never counted                         │
│  • Then: Oldest count dates                          │
│  • Then: Low stock items                             │
│                                                       │
│  Items to Count: 19 items selected                   │
│                                                       │
│  [Preview Items]                                     │
│                                                       │
│  ──────────────────────────────────────────────────  │
│                                                       │
│  Notes (optional):                                   │
│  [_______________________________________________]    │
│                                                       │
│           [Cancel]          [Start Count Session]    │
└──────────────────────────────────────────────────────┘
```

#### Step 2: Count Session Active Screen

```tsx
┌─────────────────────────────────────────────────────────────────┐
│ ACTIVE COUNT SESSION: PC-2025-11-04-001                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Progress: [████░░░░░░░░] 4 of 19 items (21%)                  │
│  Started: 9:30 AM | Counted By: John Smith                     │
│                                                                  │
│  ──────────────────────────────────────────────────────────────│
│                                                                  │
│  🔍 Quick Find: [__________________] [Search]                  │
│      (Scan barcode or type item name)                          │
│                                                                  │
│  ──────────────────────────────────────────────────────────────│
│                                                                  │
│  Items to Count:                                                │
│  ┌────────────────────────────────────────────────────────────┐│
│  │Status│Item Name          │Expected│Physical│Var │Actions  ││
│  ├────────────────────────────────────────────────────────────┤│
│  │ ✓   │Balance (60ct)     │  45    │  44    │-1  │[Edit]   ││
│  │     │                   │        │        │    │         ││
│  ├────────────────────────────────────────────────────────────┤│
│  │ ⚠   │InosiCare (30serv) │   8    │  12    │+4  │[Edit]   ││
│  │     │                   │        │        │50% │[Recount]││
│  ├────────────────────────────────────────────────────────────┤│
│  │     │Reacted Iron (60ct)│   0    │ [___]  │ -  │[Count]  ││
│  │     │                   │        │        │    │         ││
│  ├────────────────────────────────────────────────────────────┤│
│  │     │Energy Enhancer    │  32    │ [___]  │ -  │[Count]  ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Legend: ✓ Counted | ⚠ Variance >5% | ⊘ Pending               │
│                                                                  │
│  ──────────────────────────────────────────────────────────────│
│                                                                  │
│  Summary:                                                       │
│  • Items Counted: 2 of 19                                      │
│  • Variances Found: 2                                          │
│  • Large Variances (>5%): 1 (requires note)                    │
│                                                                  │
│  [Save Progress]  [Complete Session]  [Cancel Session]         │
└─────────────────────────────────────────────────────────────────┘
```

#### Step 3: Click [Count] Button

Opens inline count form:

```tsx
┌──────────────────────────────────────────────────────┐
│ Count Item: Reacted Iron (60ct)                      │
├──────────────────────────────────────────────────────┤
│                                                       │
│  Expected Quantity: 0 units                          │
│                                                       │
│  Physical Count:                                     │
│  [_____] units                                       │
│                                                       │
│  ─────────────────────────────────────               │
│  Variance will be calculated automatically           │
│                                                       │
│  Notes (optional):                                   │
│  [_______________________________________________]    │
│                                                       │
│           [Cancel]            [Save Count]           │
└──────────────────────────────────────────────────────┘
```

**If variance > 5%:**

```tsx
┌──────────────────────────────────────────────────────┐
│ Count Item: InosiCare (30serv)                       │
├──────────────────────────────────────────────────────┤
│                                                       │
│  Expected Quantity: 8 units                          │
│                                                       │
│  Physical Count:                                     │
│  [12] units                                          │
│                                                       │
│  ⚠ Large Variance: +4 units (50%)                    │
│                                                       │
│  ✅ Notes Required:                                  │
│  [Found extra box in back storage_______________]    │
│                                                       │
│  This count will require Admin approval             │
│                                                       │
│           [Recount]            [Save Count]          │
└──────────────────────────────────────────────────────┘
```

#### Step 4: Complete Session

Click "Complete Session" → Opens review modal:

```tsx
┌──────────────────────────────────────────────────────┐
│ Complete Count Session                               │
├──────────────────────────────────────────────────────┤
│                                                       │
│  Session Summary:                                    │
│  ✓ 19 of 19 items counted (100%)                     │
│                                                       │
│  Variances Found:                                    │
│  • 0% variance: 15 items ✓                          │
│  • <5% variance: 2 items ⚠                          │
│  • ≥5% variance: 2 items 🔴 (Admin approval needed) │
│                                                       │
│  Total Adjustments:                                  │
│  • Increase: +12 units across 5 items               │
│  • Decrease: -8 units across 3 items                │
│  • Net Change: +4 units                             │
│                                                       │
│  ──────────────────────────────────────────────────  │
│                                                       │
│  Items Requiring Admin Approval:                     │
│  1. InosiCare (30serv): +4 units (50%)               │
│  2. Balance (60ct): -3 units (6.7%)                  │
│                                                       │
│  [View Variance Details]                             │
│                                                       │
│  ──────────────────────────────────────────────────  │
│                                                       │
│  Session Notes:                                      │
│  [Weekly cycle count - found extra inventory in___]  │
│                                                       │
│  ──────────────────────────────────────────────────  │
│                                                       │
│  Next Steps:                                         │
│  ☑ Post adjustments for items with <5% variance     │
│  ☐ Send for Admin approval (2 items)                │
│  ☑ Update last_counted_at timestamps                │
│                                                       │
│           [Back to Edit]   [Complete & Post]         │
└──────────────────────────────────────────────────────┘
```

#### Step 5: System Actions on "Complete & Post"

```sql
-- 1. Auto-post adjustments for items with variance <5%
INSERT INTO inventory_transactions (
  inventory_item_id,
  transaction_type,
  quantity_change,
  reference_type,
  reference_id,
  notes,
  created_by
)
SELECT 
  icd.inventory_item_id,
  'adjustment',
  icd.variance,
  'count_session',
  icd.count_session_id,
  'Physical count variance',
  auth.uid()
FROM inventory_count_details icd
WHERE icd.count_session_id = [SESSION_ID]
  AND ABS(icd.variance_pct) < 5
  AND icd.requires_approval = FALSE;

-- 2. Update quantity_on_hand
UPDATE inventory_items ii
SET 
  quantity_on_hand = quantity_on_hand + icd.variance,
  last_counted_at = NOW(),
  updated_by = auth.uid()
FROM inventory_count_details icd
WHERE ii.inventory_item_id = icd.inventory_item_id
  AND icd.count_session_id = [SESSION_ID]
  AND icd.requires_approval = FALSE;

-- 3. Flag large variances for approval
UPDATE inventory_count_details
SET requires_approval = TRUE
WHERE count_session_id = [SESSION_ID]
  AND ABS(variance_pct) >= 5;

-- 4. Mark session as completed
UPDATE inventory_count_sessions
SET 
  status = 'completed',
  completed_at = NOW()
WHERE count_session_id = [SESSION_ID];
```

---

## 🔐 **ADMIN APPROVAL WORKFLOW**

### For Items with Variance ≥5%

```tsx
┌─────────────────────────────────────────────────────────────────┐
│ PENDING APPROVALS (Admin View Only)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Count Session: PC-2025-11-04-001                               │
│  Submitted: 11/04/2025 10:15 AM by John Smith                  │
│                                                                  │
│  Items Requiring Approval:                                      │
│  ┌────────────────────────────────────────────────────────────┐│
│  │Item Name          │Expected│Physical│Variance│Notes       ││
│  ├────────────────────────────────────────────────────────────┤│
│  │InosiCare (30serv) │   8    │  12    │+4 (50%)│Found extra ││
│  │                   │        │        │        │box in back ││
│  │                   │        │        │ [Approve] [Reject]  ││
│  ├────────────────────────────────────────────────────────────┤│
│  │Balance (60ct)     │  45    │  42    │-3 (7%) │Expired lot ││
│  │                   │        │        │        │discarded   ││
│  │                   │        │        │ [Approve] [Reject]  ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                  │
│  [Approve All]  [Reject All]                                    │
└─────────────────────────────────────────────────────────────────┘
```

**On Approve:**
- Posts adjustment transaction
- Updates quantity_on_hand
- Logs approval with admin user_id

---

## 💾 **DATABASE IMPLEMENTATION**

### Tables Needed (from original design)

```sql
-- 1. Count Sessions Table
CREATE TABLE inventory_count_sessions (
  count_session_id SERIAL PRIMARY KEY,
  session_number VARCHAR(50) UNIQUE NOT NULL, -- e.g., "PC-2025-11-04-001"
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  count_type VARCHAR(20) NOT NULL CHECK (count_type IN ('cycle', 'full', 'custom')),
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress' 
    CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  counted_by UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  items_total INTEGER DEFAULT 0,
  items_counted INTEGER DEFAULT 0,
  items_with_variance INTEGER DEFAULT 0,
  items_pending_approval INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID DEFAULT auth.uid(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID DEFAULT auth.uid()
);

-- 2. Count Details Table
CREATE TABLE inventory_count_details (
  count_detail_id SERIAL PRIMARY KEY,
  count_session_id INTEGER REFERENCES inventory_count_sessions(count_session_id) ON DELETE CASCADE,
  inventory_item_id INTEGER REFERENCES inventory_items(inventory_item_id),
  expected_quantity INTEGER NOT NULL,
  physical_quantity INTEGER,
  variance INTEGER GENERATED ALWAYS AS (physical_quantity - expected_quantity) STORED,
  variance_pct NUMERIC GENERATED ALWAYS AS (
    CASE 
      WHEN expected_quantity = 0 AND physical_quantity = 0 THEN 0
      WHEN expected_quantity = 0 THEN 100
      ELSE ROUND(ABS((physical_quantity - expected_quantity)::numeric / expected_quantity) * 100, 2)
    END
  ) STORED,
  notes TEXT,
  requires_approval BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending' 
    CHECK (status IN ('pending', 'counted', 'approved', 'rejected', 'posted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(count_session_id, inventory_item_id)
);

-- 3. Indexes
CREATE INDEX idx_count_sessions_status ON inventory_count_sessions(status);
CREATE INDEX idx_count_sessions_date ON inventory_count_sessions(session_date DESC);
CREATE INDEX idx_count_details_session ON inventory_count_details(count_session_id);
CREATE INDEX idx_count_details_approval ON inventory_count_details(requires_approval) WHERE requires_approval = TRUE;

-- 4. Update inventory_transactions to support count_session reference
ALTER TABLE inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_reference_type_check;
ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transactions_reference_type_check 
  CHECK (reference_type IN ('purchase_order', 'program_item', 'count_session', 'manual_adjustment', 'return'));
```

---

## 📡 **API ENDPOINTS NEEDED**

```typescript
// Inventory Items
GET    /api/inventory/items              // List all inventory items
GET    /api/inventory/items/[id]         // Get single item
PUT    /api/inventory/items/[id]         // Update (reorder points)

// Count Sessions
POST   /api/inventory/count-sessions                    // Start new session
GET    /api/inventory/count-sessions                    // List sessions
GET    /api/inventory/count-sessions/[id]               // Get session details
PUT    /api/inventory/count-sessions/[id]               // Update session (save progress)
POST   /api/inventory/count-sessions/[id]/complete      // Complete & post adjustments
DELETE /api/inventory/count-sessions/[id]               // Cancel session

// Count Items
POST   /api/inventory/count-sessions/[id]/items         // Add count for item
PUT    /api/inventory/count-sessions/[id]/items/[itemId]// Update count
GET    /api/inventory/count-sessions/[id]/items         // Get all items in session

// Approvals (Admin only)
GET    /api/inventory/approvals                         // Get pending approvals
POST   /api/inventory/approvals/[detailId]/approve      // Approve variance
POST   /api/inventory/approvals/[detailId]/reject       // Reject variance

// Metrics
GET    /api/inventory/metrics                           // Dashboard metrics
```

---

## 🎨 **REACT COMPONENTS STRUCTURE**

```
src/
├── app/
│   └── dashboard/
│       └── inventory-management/
│           └── page.tsx (UPDATE: Add sub-tabs to Tab 3)
├── components/
│   └── inventory/
│       ├── inventory-items-tab.tsx (NEW - Sub-Tab A)
│       ├── physical-count-tab.tsx (NEW - Sub-Tab B) ⭐
│       ├── count-session-card.tsx (NEW - Active session display)
│       ├── start-count-modal.tsx (NEW - Start session workflow)
│       ├── count-item-row.tsx (NEW - Item counting interface)
│       ├── count-item-modal.tsx (NEW - Count entry form)
│       ├── complete-session-modal.tsx (NEW - Review & complete)
│       ├── pending-approvals-tab.tsx (NEW - Admin only)
│       └── inventory-metrics.tsx (UPDATE - Add new metrics)
├── lib/
│   ├── hooks/
│   │   ├── use-inventory-items.ts (NEW)
│   │   ├── use-count-sessions.ts (NEW)
│   │   ├── use-count-details.ts (NEW)
│   │   └── use-inventory-metrics.ts (UPDATE)
│   └── validations/
│       └── inventory-count.ts (NEW)
```

---

## 📋 **IMPLEMENTATION CHECKLIST**

### Phase 1: Database (Week 1)
- [ ] Create `inventory_count_sessions` table
- [ ] Create `inventory_count_details` table
- [ ] Add indexes
- [ ] Update `inventory_transactions` constraints
- [ ] Seed test data

### Phase 2: API Layer (Week 1-2)
- [ ] Create inventory items endpoints
- [ ] Create count sessions endpoints
- [ ] Create count details endpoints
- [ ] Create approval endpoints
- [ ] Update metrics endpoint
- [ ] Add Zod validation schemas

### Phase 3: UI Components (Week 2-3)
- [ ] Update inventory-management page with sub-tabs
- [ ] Build Inventory Items tab (simple grid)
- [ ] Build Physical Count tab skeleton
- [ ] Build Start Count modal
- [ ] Build Count Item form
- [ ] Build Complete Session modal
- [ ] Build Pending Approvals view (Admin)
- [ ] Add 4 new metric cards

### Phase 4: Testing & Polish (Week 3-4)
- [ ] Test full count workflow
- [ ] Test variance scenarios (<5%, >5%)
- [ ] Test admin approval workflow
- [ ] Test save/resume session
- [ ] Add loading states
- [ ] Add error handling
- [ ] Mobile optimization
- [ ] User training documentation

---

## 🎯 **SUCCESS METRICS**

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Count Frequency | 100% items counted monthly | `last_counted_at` within 30 days |
| Count Accuracy | >95% items with <5% variance | Variance % in count sessions |
| Time per Item | <2 minutes | Session duration / items counted |
| User Adoption | 100% inventory staff | Active sessions per week |
| Approval Time | <24 hours | Time between submission & approval |

---

## 📝 **BEST PRACTICES IMPLEMENTED**

✅ **Cycle Counting** - 20% weekly coverage (industry standard)  
✅ **Variance Thresholds** - Auto-approve <5%, escalate ≥5%  
✅ **Audit Trail** - All counts logged immutably  
✅ **Save Progress** - Resume interrupted counts  
✅ **Admin Approval** - Large variances require oversight  
✅ **Mobile-Friendly** - Streamlined for tablet/mobile use  

---

## 🚀 **NEXT STEPS**

1. **Review this design** (15 mins)
2. **Approve database schema** 
3. **I'll start implementing Phase 1** (Database + basic API)
4. **Build prototype** for user testing
5. **Iterate based on feedback**

---

**Questions?**
- Should we implement Admin approval workflow first, or start with basic count functionality?
- Do you want email notifications for pending approvals?
- Any other metrics cards you'd like to see?

**Ready to start building! 🚀**











