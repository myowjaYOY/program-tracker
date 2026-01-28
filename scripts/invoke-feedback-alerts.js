// Quick script to invoke the process-feedback-alerts edge function
// Usage: node scripts/invoke-feedback-alerts.js [import_batch_id]

const fs = require('fs');
const path = require('path');

// Read .env.local to get the service role key
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

// Parse the service role key
const match = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
if (!match) {
  console.error('Could not find SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
const serviceRoleKey = match[1].trim();

// Get import_batch_id from command line or default to 66
const importBatchId = process.argv[2] || 66;

async function invoke() {
  console.log(`Invoking process-feedback-alerts for import_batch_id: ${importBatchId}`);
  
  const response = await fetch(
    'https://mxktlbhiknpdauzoitnm.supabase.co/functions/v1/process-feedback-alerts',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ import_batch_id: parseInt(importBatchId) }),
    }
  );

  const result = await response.json();
  
  if (response.ok) {
    console.log('\n✓ Success!\n');
    console.log('Results:');
    console.log(`  Notes created: ${result.notes_created}`);
    console.log(`  Alerts created: ${result.alerts_created}`);
    console.log(`  Duplicates skipped: ${result.duplicates_skipped}`);
    console.log(`  AI filtered: ${result.ai_filtered}`);
    if (result.errors && result.errors.length > 0) {
      console.log(`  Errors: ${result.errors.join(', ')}`);
    }
  } else {
    console.error('\n✗ Failed!\n');
    console.error(result);
  }
}

invoke().catch(console.error);
