# Inventory Management - Quick Reference Guide

## 📱 **4 Tabs Design**

### 1️⃣ **INVENTORY DASHBOARD** (Default View)
**Purpose:** View all inventory at a glance
- Summary cards (Total Items, Low Stock alerts, Out of Stock)
- Searchable data grid with all items
- Color-coded status indicators 🟢🟡🔴
- Quick actions: [Count] [Adjust] buttons on each row

**Use Case:** "Show me what's in stock right now"

---

### 2️⃣ **PHYSICAL COUNT** (Core Feature)
**Purpose:** Perform inventory counts with variance tracking
- Start count session (Cycle or Full)
- Scan/select items to count
- Enter physical quantity
- System calculates variance automatically
- Complete session → Auto-create adjustment transactions

**Use Case:** "I need to count inventory and fix discrepancies"

**Best Practice:** Count 20% of items weekly (100% coverage monthly)

---

### 3️⃣ **TRANSACTION HISTORY** (Audit Trail)
**Purpose:** View all inventory movements
- Every increase/decrease logged
- Filterable by date, type, item
- Exportable to CSV
- Immutable records (audit compliance)

**Use Case:** "Where did these 5 units go?"

**Transaction Types:**
- Purchase Receive (from PO)
- Dispensing (used in program)
- Adjustment (from count)
- Return (from member)

---

### 4️⃣ **REORDER MANAGEMENT**
**Purpose:** Manage low stock and purchase orders
- Auto-alerts when stock ≤ reorder point
- Create POs from low-stock items
- Track PO status
- Update reorder points

**Use Case:** "What do I need to order this week?"

---

## 🎯 **Key Workflows**

### **Daily Cycle Count** (5-10 mins)
```
1. Click "Physical Count" tab
2. Start New Session → Cycle Count
3. System suggests 20 items
4. Scan/count each item
5. Review variances
6. Complete & Post
```

### **Manual Adjustment** (30 seconds)
```
1. Find item in Dashboard
2. Click [Adj] button
3. Enter new quantity + reason
4. Save
```

### **Receive Purchase Order** (2-3 mins)
```
1. Reorder tab → Find PO
2. Check ✓ received items
3. Enter quantities
4. Post Receipt
```

---

## 🎨 **Visual Indicators**

| Color | Meaning | Formula |
|-------|---------|---------|
| 🟢 Green | Healthy | `on_hand > reorder_point` |
| 🟡 Yellow | Low Stock | `on_hand ≤ reorder_point` |
| 🔴 Red | Out of Stock | `on_hand = 0` |
| ⚪ Gray | Never Counted | `last_counted_at IS NULL` |

---

## 🗄️ **New Database Tables**

### `inventory_count_sessions`
Tracks each counting session (who, when, status)

### `inventory_count_details`
Individual item counts within a session (expected, physical, variance)

**Variance Calculation:**
- Variance = Physical - Expected
- Variance % = (Variance / Expected) × 100

**Variance Rules:**
- 0%: Auto-accept ✅
- <5%: Warning ⚠
- ≥5%: Requires notes + approval

---

## 🔐 **Permissions**

| Role | Dashboard | Count | Adjust | Reorder |
|------|-----------|-------|--------|---------|
| Inventory Manager | ✅ Full | ✅ All | ✅ All | ✅ All |
| Inventory Specialist | ✅ View | ✅ Yes | ✅ Limited | ✅ View |
| Provider | ✅ View | ❌ No | ❌ No | ❌ No |

---

## 📊 **Reports to Build**

1. **Inventory Valuation** - Total $ value of inventory
2. **Variance Report** - Count accuracy metrics
3. **Turnover Report** - Fast vs slow-moving items
4. **Count Compliance** - % items counted in last 30 days

---

## 🚀 **Implementation Phases**

**Week 1:** Dashboard (read-only view)  
**Week 2:** Physical Count tab (core feature)  
**Week 3:** Adjustments & History  
**Week 4:** Reorder Management + Polish  

---

## ✅ **Success Criteria**

- [ ] 100% of tracked items counted monthly
- [ ] >95% count accuracy (<5% variance)
- [ ] <2 minutes per item to count
- [ ] <2% stockouts (items at zero)
- [ ] 100% user adoption by inventory team

---

## 🎓 **Training Topics**

1. How to start a count session
2. How to handle variances
3. When to use manual adjustments
4. How to interpret visual indicators
5. How to generate reports

---

## 💡 **Pro Tips**

- **Schedule counts** during low-activity times (early morning)
- **Count high-value items** more frequently
- **Investigate large variances** (>10%) immediately
- **Use mobile device** for faster scanning
- **Export data weekly** for trend analysis

---

**Full Design Document:** See `inventory-management-tab-design.md`

**Questions?** Contact the implementation team.

















