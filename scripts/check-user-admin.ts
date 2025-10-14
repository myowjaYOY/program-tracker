import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('Please ensure .env.local contains:');
  console.error('NEXT_PUBLIC_SUPABASE_URL=your_supabase_url');
  console.error('SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUserAdminStatus() {
  try {
    console.log('🔍 Checking user admin status...\n');

    // Get all users to see their admin status
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, full_name, is_admin, is_active, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching users:', error);
      return;
    }

    console.log('📊 All Users:');
    console.log('=====================================');
    
    users?.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   Name: ${user.full_name || 'N/A'}`);
      console.log(`   Admin: ${user.is_admin ? '✅ YES' : '❌ NO'}`);
      console.log(`   Active: ${user.is_active ? '✅ YES' : '❌ NO'}`);
      console.log(`   Created: ${user.created_at}`);
      console.log('   ---');
    });

    // Check if any users have admin access
    const adminUsers = users?.filter(user => user.is_admin) || [];
    
    console.log('\n👑 Admin Users:');
    console.log('=====================================');
    
    if (adminUsers.length === 0) {
      console.log('❌ No users have admin access!');
      console.log('\n💡 To fix the 403 error, you need to grant admin access to a user.');
      console.log('   Run: npm run grant-admin -- --email=your-email@domain.com');
    } else {
      adminUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} (${user.full_name || 'No name'})`);
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

async function grantAdminAccess(email: string) {
  try {
    console.log(`🔧 Granting admin access to: ${email}\n`);

    // Update user to have admin access
    const { data, error } = await supabase
      .from('users')
      .update({ is_admin: true })
      .eq('email', email)
      .select('id, email, full_name, is_admin')
      .single();

    if (error) {
      console.error('❌ Error updating user:', error);
      return;
    }

    if (!data) {
      console.error('❌ User not found with email:', email);
      return;
    }

    console.log('✅ Successfully granted admin access!');
    console.log(`   User: ${data.email}`);
    console.log(`   Name: ${data.full_name || 'N/A'}`);
    console.log(`   Admin: ${data.is_admin ? '✅ YES' : '❌ NO'}`);
    
    console.log('\n🎉 You can now access the User Management page!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log('🔧 User Admin Management Script');
    console.log('================================');
    console.log('');
    console.log('Usage:');
    console.log('  npm run check-admin              # Check all users admin status');
    console.log('  npm run grant-admin -- --email=user@domain.com  # Grant admin access');
    console.log('');
    return;
  }

  // Check if we should grant admin access
  const emailArg = args.find(arg => arg.startsWith('--email='));
  if (emailArg) {
    const email = emailArg.split('=')[1];
    if (email) {
      await grantAdminAccess(email);
    } else {
      console.error('Error: No email provided after --email=');
      process.exit(1);
    }
  } else {
    await checkUserAdminStatus();
  }
}

main().catch(console.error);
