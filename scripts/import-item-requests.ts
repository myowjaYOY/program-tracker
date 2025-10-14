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

interface CSVRow {
  'Requested By': string;
  'Requested Date': string;
  'Member Name': string;
  'Item Description': string;
  'Quantity': string;
  'Notes': string;
  'Order Date': string;
  'Received Date': string;
}

interface ImportResult {
  success: number;
  errors: string[];
  skipped: string[];
  createdUsers: string[];
}

function parseCSV(csvContent: string): CSVRow[] {
  const lines = csvContent.split('\n');
  const headerLine = lines[0];
  if (!headerLine) {
    throw new Error('CSV file is empty');
  }
  const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, ''));
  
  return lines.slice(1)
    .filter(line => line.trim())
    .map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row as CSVRow;
    });
}

function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  // Parse MM/DD/YYYY format
  const parts = dateStr.split('/');
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    const month = parts[0].padStart(2, '0');
    const day = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return null;
}

async function findOrCreateUser(email: string): Promise<string | null> {
  try {
    // First, try to find existing user
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser && !findError) {
      return existingUser.id;
    }

    // If user doesn't exist, create a new one
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        email: email,
        full_name: email.split('@')[0], // Use email prefix as name
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (createError) {
      console.error(`Error creating user ${email}:`, createError);
      return null;
    }

    return newUser.id;
  } catch (error) {
    console.error(`Error with user ${email}:`, error);
    return null;
  }
}

async function importItemRequests(): Promise<ImportResult> {
  const result: ImportResult = {
    success: 0,
    errors: [],
    skipped: [],
    createdUsers: []
  };

  try {
    // Read the CSV file
    const csvPath = path.join(process.cwd(), 'item-requests-import.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    const rows = parseCSV(csvContent);
    console.log(`Found ${rows.length} rows to process`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        // Validate required fields
        if (!row['Item Description'] || !row['Quantity'] || !row['Requested Date'] || !row['Requested By']) {
          result.skipped.push(`Row ${i + 2}: Missing required fields - Description: "${row['Item Description']}", Quantity: "${row['Quantity']}", Date: "${row['Requested Date']}", Requested By: "${row['Requested By']}"`);
          continue;
        }

        // Parse and validate quantity
        const quantity = parseInt(row['Quantity']);
        if (isNaN(quantity) || quantity <= 0) {
          result.skipped.push(`Row ${i + 2}: Invalid quantity "${row['Quantity']}"`);
          continue;
        }

        // Parse dates
        const requestedDate = parseDate(row['Requested Date']);
        const orderedDate = parseDate(row['Order Date']);
        const receivedDate = parseDate(row['Received Date']);

        if (!requestedDate) {
          result.skipped.push(`Row ${i + 2}: Invalid requested date "${row['Requested Date']}"`);
          continue;
        }

        // Find or create user
        const userId = await findOrCreateUser(row['Requested By']);
        if (!userId) {
          result.errors.push(`Row ${i + 2}: Could not find or create user "${row['Requested By']}"`);
          continue;
        }

        // Track if we created a new user
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', row['Requested By'])
          .single();
        
        if (!existingUser) {
          result.createdUsers.push(row['Requested By']);
        }

        // Determine status based on dates
        let status = 'Pending';
        if (receivedDate) {
          status = 'Received';
        } else if (orderedDate) {
          status = 'Ordered';
        }

        // Prepare item request data
        const itemRequestData = {
          item_description: row['Item Description'],
          quantity: quantity,
          notes: row['Notes'] || null,
          requested_date: requestedDate,
          requested_by: userId,
          lead_id: null, // No member lookups as specified
          ordered_date: orderedDate,
          ordered_by: orderedDate ? userId : null,
          received_date: receivedDate,
          received_by: receivedDate ? userId : null,
          is_cancelled: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Insert the item request
        const { error: insertError } = await supabase
          .from('item_requests')
          .insert(itemRequestData);

        if (insertError) {
          result.errors.push(`Row ${i + 2}: Database error - ${insertError.message}`);
        } else {
          result.success++;
          console.log(`✓ Imported row ${i + 2}: ${row['Item Description']}`);
        }

      } catch (error) {
        result.errors.push(`Row ${i + 2}: Unexpected error - ${error}`);
      }
    }

  } catch (error) {
    result.errors.push(`File read error: ${error}`);
  }

  return result;
}

// Run the import
async function main() {
  console.log('🚀 Starting Item Requests Import...\n');
  
  const result = await importItemRequests();
  
  console.log('\n📊 Import Results:');
  console.log(`✅ Successfully imported: ${result.success} records`);
  console.log(`❌ Errors: ${result.errors.length}`);
  console.log(`⏭️  Skipped: ${result.skipped.length}`);
  console.log(`👥 New users created: ${result.createdUsers.length}`);
  
  if (result.createdUsers.length > 0) {
    console.log('\n👥 New users created:');
    result.createdUsers.forEach(email => console.log(`  - ${email}`));
  }
  
  if (result.errors.length > 0) {
    console.log('\n❌ Errors:');
    result.errors.forEach(error => console.log(`  - ${error}`));
  }
  
  if (result.skipped.length > 0) {
    console.log('\n⏭️  Skipped records:');
    result.skipped.forEach(skip => console.log(`  - ${skip}`));
  }
  
  console.log('\n✨ Import completed!');
}

main().catch(console.error);
