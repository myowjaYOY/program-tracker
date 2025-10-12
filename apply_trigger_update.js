const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://mxktlbhiknpdauzoitnm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14a3RsYmhpa25wZGF1em9pdG5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyMTg1NTAzMCwiZXhwIjoyMDM3NDMxMDMwfQ.3Ux9Sc8e3nLxN6TYp5tXWUy1m_K2O2OFQB9CySZ-_pI';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function applyTriggerUpdate() {
  try {
    console.log('📝 Reading SQL file...');
    const sql = fs.readFileSync('update_contracted_margin_trigger.sql', 'utf8');
    
    console.log('🔄 Applying database trigger update...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('❌ Error applying trigger update:', error);
      process.exit(1);
    }
    
    console.log('✅ Trigger update applied successfully!');
    console.log('   - Function: set_contracted_at_margin_on_activation()');
    console.log('   - Trigger: trigger_set_contracted_at_margin');
    console.log('   - Now uses correct margin formula (excludes taxes, handles negative finance charges)');
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

applyTriggerUpdate();

