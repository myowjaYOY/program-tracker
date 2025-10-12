require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Financial calculation functions (matching our new implementation)
function calculateTaxesOnTaxableItems(totalCharge, totalTaxableCharge, discounts, taxRate = 0.0825) {
  if (totalCharge <= 0 || totalTaxableCharge <= 0) return 0;
  const taxablePercentage = totalTaxableCharge / totalCharge;
  const taxableDiscount = Math.abs(discounts) * taxablePercentage;
  const discountedTaxableCharge = totalTaxableCharge - taxableDiscount;
  return discountedTaxableCharge * taxRate;
}

function calculateProjectedPrice(totalCharge, taxes, financeCharges, discounts) {
  return totalCharge + taxes + financeCharges + discounts;
}

function calculateProjectedMargin(projectedPrice, totalCost, financeCharges = 0, taxes = 0) {
  const preTaxRevenue = projectedPrice - taxes;
  if (preTaxRevenue <= 0) return 0;
  const adjustedCost = financeCharges < 0 ? totalCost + Math.abs(financeCharges) : totalCost;
  return ((preTaxRevenue - adjustedCost) / preTaxRevenue) * 100;
}

async function auditMargins() {
  console.log('🔍 Starting Margin Audit...\n');
  
  // Get all programs with finances - using RPC or direct query
  const { data: programs, error: programsError } = await supabase.rpc('get_programs_with_finances');

  if (programsError) {
    console.log('RPC not available, trying direct query...');
    
    // Fallback: Try getting data through API
    console.log('\n⚠️  Cannot access database directly with anon key due to RLS policies.');
    console.log('Please run the audit through the authenticated API endpoint instead.');
    console.log('\nTo audit margins:');
    console.log('1. Open your browser to http://localhost:3000/dashboard/programs');
    console.log('2. Open browser DevTools (F12)');
    console.log('3. Go to Console tab');
    console.log('4. Run: fetch("/api/debug/audit-margins").then(r => r.json()).then(console.table)');
    return;
  }

  console.log(`Found ${programs.length} programs\n`);
}

auditMargins().catch(console.error);

