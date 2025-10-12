const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mxktlbhiknpdauzoitnm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14a3RsYmhpa25wZGF1em9pdG5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU0NDgzODcsImV4cCI6MjA2MTAyNDM4N30.xtu2QK-pj8_Dx5k1wseQsX7-iyt-YYc2cJay06sAFi8';

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
  
  // Get all programs with finances
  const { data: programs, error: programsError } = await supabase
    .from('member_programs')
    .select(`
      member_program_id,
      program_template_name,
      total_cost,
      total_charge,
      program_status(status_name),
      member_program_finances(
        final_total_price,
        margin,
        finance_charges,
        discounts,
        taxes,
        contracted_at_margin,
        variance
      )
    `)
    .order('member_program_id');

  if (programsError) {
    console.error('Error fetching programs:', programsError);
    return;
  }

  console.log(`Found ${programs.length} programs\n`);
  console.log('='.repeat(120));

  const discrepancies = [];

  for (const program of programs) {
    const finances = program.member_program_finances?.[0];
    if (!finances) {
      console.log(`Program ${program.member_program_id}: No finances record`);
      continue;
    }

    // Get items to calculate taxable charge
    const { data: items } = await supabase
      .from('member_program_items')
      .select('quantity, item_cost, item_charge, therapies(taxable)')
      .eq('member_program_id', program.member_program_id)
      .eq('active_flag', true);

    let totalCost = 0;
    let totalCharge = 0;
    let totalTaxableCharge = 0;

    (items || []).forEach(item => {
      const quantity = item.quantity || 1;
      const cost = item.item_cost || 0;
      const charge = item.item_charge || 0;
      const isTaxable = item.therapies?.taxable === true;

      totalCost += cost * quantity;
      totalCharge += charge * quantity;
      if (isTaxable) {
        totalTaxableCharge += charge * quantity;
      }
    });

    // Calculate what margin SHOULD be
    const financeCharges = Number(finances.finance_charges || 0);
    const discounts = Number(finances.discounts || 0);
    
    const taxes = calculateTaxesOnTaxableItems(totalCharge, totalTaxableCharge, discounts);
    const projectedPrice = calculateProjectedPrice(totalCharge, taxes, financeCharges, discounts);
    const correctMargin = calculateProjectedMargin(projectedPrice, totalCost, financeCharges, taxes);

    const currentMargin = Number(finances.margin || 0);
    const difference = Math.abs(correctMargin - currentMargin);

    const statusName = program.program_status?.status_name || 'Unknown';
    const isActive = statusName.toLowerCase() === 'active';

    // For active programs, also check margin on locked price
    let correctMarginForActive = null;
    if (isActive && finances.contracted_at_margin) {
      const lockedPrice = Number(finances.final_total_price || 0);
      const preTaxLockedPrice = lockedPrice - taxes;
      const adjustedCost = financeCharges < 0 ? totalCost + Math.abs(financeCharges) : totalCost;
      correctMarginForActive = preTaxLockedPrice > 0
        ? ((preTaxLockedPrice - adjustedCost) / preTaxLockedPrice) * 100
        : 0;
    }

    if (difference > 0.1) { // More than 0.1% difference
      discrepancies.push({
        programId: program.member_program_id,
        name: program.program_template_name,
        status: statusName,
        currentMargin,
        correctMargin: isActive && correctMarginForActive !== null ? correctMarginForActive : correctMargin,
        difference,
        financeCharges,
        taxes,
        totalCost,
        projectedPrice,
        lockedPrice: isActive ? Number(finances.final_total_price || 0) : null
      });

      console.log(`\n📊 Program ${program.member_program_id}: ${program.program_template_name}`);
      console.log(`   Status: ${statusName}`);
      console.log(`   Current Margin: ${currentMargin.toFixed(2)}%`);
      if (isActive && correctMarginForActive !== null) {
        console.log(`   Correct Margin (on locked price): ${correctMarginForActive.toFixed(2)}%`);
      } else {
        console.log(`   Correct Margin: ${correctMargin.toFixed(2)}%`);
      }
      console.log(`   Difference: ${difference.toFixed(2)}%`);
      console.log(`   Total Cost: $${totalCost.toFixed(2)}`);
      console.log(`   Projected Price: $${projectedPrice.toFixed(2)}`);
      if (isActive) {
        console.log(`   Locked Price: $${Number(finances.final_total_price || 0).toFixed(2)}`);
      }
      console.log(`   Finance Charges: $${financeCharges.toFixed(2)}`);
      console.log(`   Taxes: $${taxes.toFixed(2)}`);
    }
  }

  console.log('\n' + '='.repeat(120));
  console.log(`\n📈 Summary:`);
  console.log(`   Total Programs: ${programs.length}`);
  console.log(`   Programs with Discrepancies: ${discrepancies.length}`);
  
  if (discrepancies.length > 0) {
    console.log(`\n⚠️  Programs Needing Correction:`);
    discrepancies.forEach(d => {
      console.log(`   - Program ${d.programId} (${d.status}): ${d.currentMargin.toFixed(1)}% → ${d.correctMargin.toFixed(1)}% (Δ ${d.difference.toFixed(1)}%)`);
    });
  } else {
    console.log(`\n✅ All margins are correct!`);
  }
}

auditMargins().catch(console.error);

