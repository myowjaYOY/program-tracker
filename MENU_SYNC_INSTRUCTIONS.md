# Menu Items Sync Instructions

**DATE**: October 27, 2025  
**PURPOSE**: Add "Dashboard Analytics" to user delegation system

---

## What Was Added

✅ **Menu Item**: `/dashboard/admin/analytics` - Dashboard Analytics  
✅ **Location**: `src/lib/config/menu-items.ts` (line 112-117)  
✅ **Section**: Admin  
✅ **Icon**: Dashboard

---

## How to Sync Menu Items

### **Option 1: Via User Management UI** (Recommended)

1. **Navigate to User Management**:
   - Go to: **Dashboard → Admin → User Management**

2. **Click "Sync Menu Items" Button**:
   - Located in the top-right corner of the user management page
   - Button will show loading spinner while syncing

3. **Verify Success**:
   - You should see a success message
   - New menu item "Dashboard Analytics" will now be available

4. **Auto-Assignment**:
   - All admin users will automatically get permission to this new page
   - Non-admin users will need permissions manually assigned

---

### **Option 2: Via API** (Manual)

```bash
# Using PowerShell
cd c:\GitHub\program-tracker

# Get auth token (you'll need to get this from browser dev tools)
$token = "YOUR_SUPABASE_AUTH_TOKEN"

# Call sync API
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/menu-items/sync" `
  -Method Post `
  -Headers @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
  }
```

---

## What Happens During Sync

1. **Reads** `MENU_ITEMS` array from `src/lib/config/menu-items.ts`
2. **Checks** existing menu items in `menu_items` table
3. **Updates** existing items if labels/icons changed
4. **Inserts** new items (like Dashboard Analytics)
5. **Auto-grants** permissions to all admin users
6. **Returns** summary: synced count, new count, total count

---

## Verify Sync Was Successful

### **Check Database** (Optional):
```sql
-- Verify menu item exists
SELECT * FROM menu_items 
WHERE path = '/dashboard/admin/analytics';

-- Verify admin users have permission
SELECT u.email, ump.menu_path 
FROM user_menu_permissions ump
JOIN users u ON u.id = ump.user_id
WHERE ump.menu_path = '/dashboard/admin/analytics';
```

### **Check UI**:
1. Refresh your browser
2. Navigate to **Dashboard → Admin → User Management**
3. Click on any user → "Manage Permissions"
4. You should see "Dashboard Analytics" in the available permissions list

---

## Granting Permissions to Non-Admin Users

1. **Navigate**: Dashboard → Admin → User Management
2. **Select User**: Click on the user row
3. **Manage Permissions**: Click "Manage Permissions" button
4. **Check Box**: Find "Dashboard Analytics" and check it
5. **Save**: Click "Update Permissions"

---

## Expected Results

### **For Admin Users**:
✅ Automatically get access to Dashboard Analytics  
✅ Can see it in the sidebar navigation  
✅ Can access `/dashboard/admin/analytics` directly

### **For Non-Admin Users**:
⏳ Need manual permission assignment  
❌ Won't see it in sidebar until permission granted  
❌ Will get 403 if they try to access directly

---

## Troubleshooting

### **Issue**: "Sync Menu Items" button not working
**Solution**: 
- Check browser console for errors
- Verify you're logged in as admin
- Try refreshing the page

### **Issue**: Menu item not appearing after sync
**Solution**: 
- Hard refresh browser (Ctrl+Shift+R)
- Clear browser cache
- Log out and log back in

### **Issue**: Users still can't access Dashboard Analytics
**Solution**: 
- Verify sync was successful (check database)
- Manually grant permission to user
- Check that user has `is_admin: true` OR has explicit permission

---

## Database Tables Involved

- **`menu_items`**: Stores all available menu items
- **`user_menu_permissions`**: Stores user-specific permissions (menu_path + user_id)
- **`users`**: User accounts with `is_admin` flag

---

## Important Notes

1. **Always sync** after adding new pages to ensure proper security
2. **Admin users** get all permissions automatically (`*` wildcard)
3. **Non-admin users** need explicit permissions for each page
4. **Menu sync** is idempotent (safe to run multiple times)
5. **Existing permissions** are preserved during sync

---

**Next Step**: Run the menu sync to make Dashboard Analytics available for delegation!

---

**STATUS**: ✅ Configuration complete, ready to sync

**Prepared by**: Cursor AI Assistant  
**Date**: October 27, 2025

