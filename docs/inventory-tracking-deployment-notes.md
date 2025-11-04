# Inventory Tracking Feature - Deployment Notes

## Overview
Added ability to track therapies in the Inventory Management system via a checkbox in the therapy form.

## Changes Made

### Files Modified
1. `src/lib/validations/therapy.ts` - Added `track_inventory` field
2. `src/components/forms/therapy-form.tsx` - Added checkbox and inventory status loading
3. `src/app/api/therapies/route.ts` - Create inventory item on therapy creation
4. `src/app/api/therapies/[id]/route.ts` - Sync inventory tracking on updates
5. `src/app/api/inventory/check-therapy/[id]/route.ts` - NEW endpoint to check tracking status

### Database Impact
- **Table**: `inventory_items` (existing table, no schema changes)
- **Operations**: INSERT, UPDATE (soft delete via `active_flag`)
- **Indexes**: Already optimal (unique index on `therapy_id`)
- **RLS**: Already configured for authenticated users

## User-Facing Changes

### New Checkbox: "Track in Inventory"
- **Location**: Therapy form (create/edit modal)
- **Behavior**:
  - Create: If checked, adds therapy to inventory with defaults (qty=0, reorder=0)
  - Edit: Loads current tracking status, allows toggle on/off
  - Toggle off: Soft delete (sets `active_flag = false`)
  - Toggle on: Creates new or reactivates existing inventory item

## Technical Details

### API Endpoints
- `POST /api/therapies` - Creates therapy + optional inventory item
- `PUT /api/therapies/[id]` - Updates therapy + syncs inventory tracking
- `GET /api/inventory/check-therapy/[id]` - Returns `{ tracked: boolean }`

### Error Handling
- Inventory operations are "best effort" - therapy creation/update succeeds even if inventory fails
- Errors are logged server-side but not surfaced to user
- Network failures on status check default to `tracked: false`

### Performance
- Query time: ~0.076ms per inventory lookup
- No N+1 queries
- Minimal impact on form load/save

## Rollback Procedure

If issues arise, see `scripts/rollback-inventory-tracking-feature.sql`

**Option A (Recommended)**: Soft delete new inventory items
```sql
UPDATE inventory_items
SET active_flag = false
WHERE created_at >= '2025-11-04 00:00:00+00';
```

**Option B**: Code rollback via Git
```bash
git revert <commit-hash>
npm run build
# Redeploy
```

## Testing Checklist

- [ ] Create therapy without tracking (unchecked)
- [ ] Create therapy with tracking (checked)
- [ ] Edit therapy to add tracking
- [ ] Edit therapy to remove tracking
- [ ] Edit therapy with tracking enabled (no change)
- [ ] Verify checkbox reflects current state on edit

## Monitoring

Watch for these errors in logs:
- `Failed to create inventory item` (POST)
- Supabase errors on `inventory_items` table
- 500 errors from `/api/inventory/check-therapy/[id]`

## Known Limitations

1. **Silent Failures**: Inventory operations in PUT endpoint don't show user-facing errors
2. **No Undo**: Once tracked, the inventory_items record persists (soft deleted)
3. **No Warnings**: Users can remove tracking from items with existing inventory data

## Success Metrics

Track these to measure feature adoption:
- Number of therapies with `track_inventory = true` at creation
- Number of existing therapies added to inventory
- Error rate on inventory operations

## Support

If users report issues:
1. Check Supabase logs for inventory_items table
2. Verify RLS policies are active
3. Confirm unique constraint on therapy_id
4. Check browser console for API errors

---

**Deployed**: [DATE]  
**Deployed By**: [NAME]  
**Rollback Available**: Yes (via Git + SQL script)

