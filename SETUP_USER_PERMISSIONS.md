# 🚀 User Permissions System Setup Guide

## **📋 Overview**

This system provides simple menu-based user permissions where:

- **Admin users**: See all menu items (full access)
- **Regular users**: Only see assigned menu items
- **New menu items**: Automatically available for assignment after sync

## **🗄️ Database Setup**

### **1. Run the Database Schema**

Execute the SQL file to create the required tables:

```sql
-- Run this in your Supabase SQL editor or database client
\i user_permissions_schema.sql
```

This will create:

- `menu_items` table (registry of all menu items)
- `user_menu_permissions` table (user-specific permissions)
- Add `is_admin` and `is_active` columns to `users` table
- Insert default menu items

### **2. Set Admin Users**

Update specific users to be admins:

```sql
-- Make specific users admins
UPDATE users SET is_admin = true WHERE email = 'your-admin@email.com';
UPDATE users SET is_admin = true WHERE email = 'another-admin@email.com';
```

## **🎛️ Admin Interface**

### **1. Access User Management**

- Navigate to **Admin > User Management** in the sidebar
- Only admin users can access this page

### **2. Sync Menu Items**

- Click **"Sync Menu Items"** button to update the menu registry
- This should be done whenever you add new menu items to the code
- New menu items are automatically assigned to admin users

### **3. Manage Users**

**Add New User:**

- Click **"Add User"** button
- Fill in email, full name, password
- Set admin status and active status
- User will be created in Supabase Auth

**Edit User Permissions:**

- Click on any user row to edit
- For non-admin users: Select which menu items they can access
- For admin users: They automatically have access to all items

## **🔄 Adding New Menu Items**

### **1. Update Menu Registry**

Add new menu items to `src/lib/config/menu-items.ts`:

```typescript
export const MENU_ITEMS: MenuItem[] = [
  // ... existing items
  {
    path: '/dashboard/new-feature',
    label: 'New Feature',
    section: 'admin',
    icon: 'NewIcon',
  },
];
```

### **2. Update Sidebar**

Add the new menu item to `src/components/layout/Sidebar.tsx`:

```typescript
const adminNav = [
  // ... existing items
  { label: 'New Feature', icon: <NewIcon />, path: '/dashboard/new-feature' },
];
```

### **3. Sync Menu Items**

- Go to User Management page
- Click **"Sync Menu Items"** button
- New menu item will be added to the database
- Admin users will automatically get access
- You can then assign it to other users

## **🔐 Permission System**

### **How It Works:**

1. **Admin Users**: Automatically see all menu items
2. **Regular Users**: Only see menu items they have been granted access to
3. **Menu Access**: All or nothing - if you can see the menu item, you have full access to that page

### **Security:**

- All API endpoints check for admin permissions
- Route protection middleware (to be implemented)
- Permission checks on page load

## **📱 User Experience**

### **For Admin Users:**

- See all menu items in sidebar
- Access to User Management page
- Can create/edit users and assign permissions

### **For Regular Users:**

- Only see assigned menu items in sidebar
- Cannot access User Management page
- Full access to pages they can see

## **🛠️ Next Steps**

1. **Run the database schema**
2. **Set yourself as admin**
3. **Test the User Management interface**
4. **Create test users and assign permissions**
5. **Test dynamic sidebar filtering** ✅ **COMPLETED**

## **🔧 Troubleshooting**

### **Common Issues:**

**"Admin access required" error:**

- Make sure your user has `is_admin = true` in the database

**Menu items not showing:**

- Run "Sync Menu Items" to update the registry
- Check that menu items are properly defined in the config

**Users can't see assigned menu items:**

- Check that the user has the correct permissions in the database
- Verify the user is not marked as inactive
- Check browser console for any API errors
- Try refreshing the page to reload permissions

## **📞 Support**

If you encounter any issues:

1. Check the browser console for errors
2. Verify database schema is properly set up
3. Ensure admin users are correctly configured
4. Check that menu items are synced properly
