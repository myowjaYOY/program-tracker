import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  calculateTaxesOnTaxableItems,
  calculateProjectedPrice,
  calculateProjectedMargin,
} from '@/lib/utils/financial-calculations';

/**
 * Data Integrity Audit Endpoint
 * 
 * Verifies:
 * 1. Stored total_cost/total_charge match sum of items
 * 2. Stored taxes match calculated taxes (with proportional discounts)
 * 3. Stored final_total_price matches calculated price accounting for variance
 *    Formula: calculatedPrice - variance = final_total_price
 * 4. Stored margin matches calculated margin
 *    - Contracted programs (any status): margin calculated on locked price
 *    - Non-contracted programs: margin calculated on projected price
 * 5. Contracted program variance and margins are correct (regardless of status)
 * 
 * Usage: GET /api/debug/verify-data-integrity
 * Optional query params:
 *   - programId: Check specific program only
 *   - autoFix: Set to 'true' to automatically fix discrepancies
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { session },
    error: authError,
  } = await supabase.auth.getSession();

  if (authError || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is admin (using the users table is_admin column)
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('is_admin, is_active')
    .eq('id', session.user.id)
    .single();

  if (userError || !userData) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (!userData.is_admin) {
    return NextResponse.json({ 
      error: 'Admin access required. Contact your administrator if you need access to this feature.',
      requiredRole: 'admin'
    }, { status: 403 });
  }

  if (!userData.is_active) {
    return NextResponse.json({ 
      error: 'Your account is inactive. Contact your administrator.',
      requiredRole: 'admin'
    }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const programIdParam = searchParams.get('programId');
    const autoFix = searchParams.get('autoFix') === 'true';

    console.log('🔍 Starting Data Integrity Audit...');
    if (autoFix) {
      console.log('⚠️  AUTO-FIX MODE ENABLED');
    }

    // Get all programs or specific program
    let query = supabase
      .from('member_programs')
      .select(`
        member_program_id,
        program_template_name,
        total_cost,
        total_charge,
        program_status(status_name),
        member_program_finances(
          member_program_finance_id,
          margin,
          contracted_at_margin,
          final_total_price,
          finance_charges,
          discounts,
          taxes,
          variance
        )
      `);

    if (programIdParam) {
      query = query.eq('member_program_id', parseInt(programIdParam));
    }

    const { data: programs, error: programsError } = await query;

    if (programsError) {
      return NextResponse.json({ error: programsError.message }, { status: 500 });
    }

    const results = [];
    let totalIssues = 0;
    let totalFixed = 0;

    for (const program of programs || []) {
      const programId = program.member_program_id;
      const statusName = (program.program_status as any)?.status_name || 'Unknown';
      const isActive = statusName.toLowerCase() === 'active';
      const finances = program.member_program_finances?.[0];

      const issues: string[] = [];
      const warnings: string[] = [];

      // Get items
      const { data: items, error: itemsError } = await supabase
        .from('member_program_items')
        .select(`
          quantity,
          item_cost,
          item_charge,
          therapies(taxable)
        `)
        .eq('member_program_id', programId)
        .eq('active_flag', true);

      if (itemsError || !items) {
        issues.push(`Failed to fetch items: ${itemsError?.message}`);
        results.push({
          programId,
          programName: program.program_template_name,
          status: statusName,
          issues,
          warnings,
          passed: false,
        });
        totalIssues += issues.length;
        continue;
      }

      // Calculate totals from items
      let calculatedCost = 0;
      let calculatedCharge = 0;
      let calculatedTaxableCharge = 0;

      items.forEach((item: any) => {
        const quantity = item.quantity || 1;
        const cost = item.item_cost || 0;
        const charge = item.item_charge || 0;
        const isTaxable = item.therapies?.taxable === true;

        calculatedCost += cost * quantity;
        calculatedCharge += charge * quantity;

        if (isTaxable) {
          calculatedTaxableCharge += charge * quantity;
        }
      });

      // Check 1: Stored cost/charge vs calculated
      const storedCost = Number(program.total_cost || 0);
      const storedCharge = Number(program.total_charge || 0);
      const costDiff = Math.abs(storedCost - calculatedCost);
      const chargeDiff = Math.abs(storedCharge - calculatedCharge);

      if (costDiff > 0.01) {
        issues.push(
          `total_cost mismatch: stored $${storedCost.toFixed(2)} vs calculated $${calculatedCost.toFixed(2)} (diff: $${costDiff.toFixed(2)})`
        );
      }

      if (chargeDiff > 0.01) {
        issues.push(
          `total_charge mismatch: stored $${storedCharge.toFixed(2)} vs calculated $${calculatedCharge.toFixed(2)} (diff: $${chargeDiff.toFixed(2)})`
        );
      }

      // Calculate taxes and projected price (use defaults if no finances record)
      const calculatedTaxes = finances ? calculateTaxesOnTaxableItems(
        calculatedCharge,
        calculatedTaxableCharge,
        Number(finances.discounts || 0)
      ) : 0;

      const calculatedPrice = calculateProjectedPrice(
        calculatedCharge,
        calculatedTaxes,
        Number(finances?.finance_charges || 0),
        Number(finances?.discounts || 0)
      );

      // Calculate expected margin (always available)
      let expectedMargin: number;
      
      if (finances?.contracted_at_margin) {
        // For contracted programs (any status), margin should be calculated on locked price
        const lockedPrice = Number(finances.final_total_price || 0);
        const financeCharges = Number(finances.finance_charges || 0);
        const preTaxLockedPrice = lockedPrice - calculatedTaxes;
        const adjustedCost = financeCharges < 0 
          ? calculatedCost + Math.abs(financeCharges)
          : calculatedCost;
        
        expectedMargin = preTaxLockedPrice > 0
          ? ((preTaxLockedPrice - adjustedCost) / preTaxLockedPrice) * 100
          : 0;
      } else {
        // For non-contracted programs (Quote, etc.), margin is calculated on current price
        expectedMargin = calculateProjectedMargin(
          calculatedPrice,
          calculatedCost,
          Number(finances?.finance_charges || 0),
          calculatedTaxes
        );
      }

      if (finances) {
        // Check 2: Stored taxes vs calculated
        const storedTaxes = Number(finances.taxes || 0);
        const taxesDiff = Math.abs(storedTaxes - calculatedTaxes);

        if (taxesDiff > 0.01) {
          issues.push(
            `taxes mismatch: stored $${storedTaxes.toFixed(2)} vs calculated $${calculatedTaxes.toFixed(2)} (diff: $${taxesDiff.toFixed(2)})`
          );
        }

        // Check 3: final_total_price vs calculated (accounting for variance)
        // For Active programs: final_total_price is locked, variance tracks drift
        // Formula: calculatedPrice - variance = final_total_price
        // Or equivalently: calculatedPrice = final_total_price + variance
        const storedFinalPrice = Number(finances.final_total_price || 0);
        const storedVariance = Number(finances.variance || 0);
        
        // Expected final price accounting for variance
        const expectedFinalPrice = calculatedPrice - storedVariance;
        const finalPriceDiff = Math.abs(storedFinalPrice - expectedFinalPrice);

        if (finalPriceDiff > 0.01) {
          issues.push(
            `final_total_price mismatch: stored $${storedFinalPrice.toFixed(2)} vs expected $${expectedFinalPrice.toFixed(2)} (calculated: $${calculatedPrice.toFixed(2)}, variance: $${storedVariance.toFixed(2)}, diff: $${finalPriceDiff.toFixed(2)})`
          );
        }

        // Check 4: Margin calculation

        const storedMargin = Number(finances.margin || 0);
        const marginDiff = Math.abs(storedMargin - expectedMargin);

        if (marginDiff > 0.1) {
          issues.push(
            `margin mismatch: stored ${storedMargin.toFixed(2)}% vs calculated ${expectedMargin.toFixed(2)}% (diff: ${marginDiff.toFixed(2)}%)`
          );
        }

        // Check 5: Contracted program specific checks
        if (finances.contracted_at_margin) {
          // Variance should be projectedPrice - lockedPrice
          const expectedVariance = calculatedPrice - Number(finances.final_total_price || 0);
          const storedVariance = Number(finances.variance || 0);
          const varianceDiff = Math.abs(storedVariance - expectedVariance);

          // Only flag variance mismatch if there's a meaningful difference (> 1 cent)
          // This handles floating-point precision issues where 0.00 vs 0.001 might be flagged
          if (varianceDiff > 0.01) {
            issues.push(
              `variance mismatch: stored $${storedVariance.toFixed(2)} vs calculated $${expectedVariance.toFixed(2)} (diff: $${varianceDiff.toFixed(2)})`
            );
          }

          // Check if margins match contracted margin (regardless of current status)
          const contractedMargin = Number(finances.contracted_at_margin || 0);
          const storedMarginDiff = Math.abs(storedMargin - contractedMargin);
          const calculatedMarginDiff = Math.abs(expectedMargin - contractedMargin);

          if (storedMarginDiff > 0.1) {
            issues.push(
              `stored margin differs from contracted margin: stored ${storedMargin.toFixed(2)}% vs contracted ${contractedMargin.toFixed(2)}% (diff: ${storedMarginDiff.toFixed(2)}%)`
            );
          }

          if (calculatedMarginDiff > 0.1) {
            issues.push(
              `calculated margin differs from contracted margin: calculated ${expectedMargin.toFixed(2)}% vs contracted ${contractedMargin.toFixed(2)}% (diff: ${calculatedMarginDiff.toFixed(2)}%)`
            );
          }
        }
      } else {
        warnings.push('No finances record found');
      }

      // Auto-fix if enabled and there are issues
      if (autoFix && (issues.length > 0 || warnings.length > 0)) {
        console.log(`🔧 Auto-fixing Program ${programId}...`);
        
        // Fix member_programs table
        if (costDiff > 0.01 || chargeDiff > 0.01) {
          await supabase
            .from('member_programs')
            .update({
              total_cost: calculatedCost,
              total_charge: calculatedCharge,
              updated_by: session.user.id,
            })
            .eq('member_program_id', programId);
          
          console.log(`  ✅ Fixed total_cost and total_charge`);
        }

        // Fix finances table
        if (finances) {
          const calculatedTaxes = calculateTaxesOnTaxableItems(
            calculatedCharge,
            calculatedTaxableCharge,
            Number(finances.discounts || 0)
          );

          const calculatedPrice = calculateProjectedPrice(
            calculatedCharge,
            calculatedTaxes,
            Number(finances.finance_charges || 0),
            Number(finances.discounts || 0)
          );

          let expectedMargin: number;
          
          if (isActive && finances.contracted_at_margin) {
            const lockedPrice = Number(finances.final_total_price || 0);
            const financeCharges = Number(finances.finance_charges || 0);
            const preTaxLockedPrice = lockedPrice - calculatedTaxes;
            const adjustedCost = financeCharges < 0 
              ? calculatedCost + Math.abs(financeCharges)
              : calculatedCost;
            
            expectedMargin = preTaxLockedPrice > 0
              ? ((preTaxLockedPrice - adjustedCost) / preTaxLockedPrice) * 100
              : 0;
          } else {
            expectedMargin = calculateProjectedMargin(
              calculatedPrice,
              calculatedCost,
              Number(finances.finance_charges || 0),
              calculatedTaxes
            );
          }

          const updateData: any = {
            taxes: calculatedTaxes,
            margin: expectedMargin,
            updated_by: session.user.id,
          };

          if (isActive && finances.contracted_at_margin) {
            const expectedVariance = calculatedPrice - Number(finances.final_total_price || 0);
            updateData.variance = expectedVariance;
          } else {
            updateData.final_total_price = calculatedPrice;
          }

          await supabase
            .from('member_program_finances')
            .update(updateData)
            .eq('member_program_id', programId);

          console.log(`  ✅ Fixed finances (margin, taxes, variance)`);
          totalFixed++;
        }
      }

      totalIssues += issues.length;

      results.push({
        programId,
        programName: program.program_template_name,
        status: statusName,
        issues,
        warnings,
        passed: issues.length === 0,
        storedValues: {
          cost: storedCost,
          charge: storedCharge,
          margin: finances?.margin,
          taxes: finances?.taxes,
          financeCharges: finances?.finance_charges,
          discounts: finances?.discounts,
          variance: finances?.variance,
          lockedPrice: finances?.final_total_price,
          contractedMargin: finances?.contracted_at_margin,
        },
        calculatedValues: {
          cost: calculatedCost,
          charge: calculatedCharge,
          projectedPrice: calculatedPrice,
          projectedMargin: expectedMargin,
        },
      });
    }

    const summary = {
      totalPrograms: results.length,
      programsWithIssues: results.filter(r => r.issues.length > 0).length,
      programsWithWarnings: results.filter(r => r.warnings.length > 0).length,
      totalIssues,
      totalFixed: autoFix ? totalFixed : 0,
      autoFixEnabled: autoFix,
    };

    console.log('✅ Audit Complete!');
    console.log(`   Programs Checked: ${summary.totalPrograms}`);
    console.log(`   Issues Found: ${summary.totalIssues}`);
    if (autoFix) {
      console.log(`   Programs Fixed: ${summary.totalFixed}`);
    }

    // Generate HTML response
    const html = generateHtmlReport(summary, results, autoFix);
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error: any) {
    console.error('Audit error:', error);
    
    // If it's an admin access error, return a user-friendly HTML page
    if (error?.message?.includes('Admin access required') || error?.status === 403) {
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access Denied - Data Integrity Audit</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f9fafb;
      color: #111827;
      padding: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .container {
      background: white;
      border-radius: 8px;
      padding: 3rem;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      text-align: center;
      max-width: 500px;
    }
    .icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
    h1 {
      color: #dc2626;
      margin-bottom: 1rem;
    }
    .message {
      color: #6b7280;
      margin-bottom: 2rem;
      line-height: 1.6;
    }
    .btn {
      background: #8b5cf6;
      color: white;
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      display: inline-block;
    }
    .btn:hover {
      background: #7c3aed;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🔒</div>
    <h1>Access Denied</h1>
    <div class="message">
      You need administrator privileges to access the Data Integrity Audit tool.
      <br><br>
      Contact your system administrator if you believe you should have access to this feature.
    </div>
    <a href="/dashboard/programs" class="btn">← Back to Programs</a>
  </div>
</body>
</html>
      `;
      return new NextResponse(html, {
        status: 403,
        headers: {
          'Content-Type': 'text/html',
        },
      });
    }
    
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateHtmlReport(summary: any, results: any[], autoFix: boolean): string {
  const statusColor = summary.totalIssues === 0 ? '#22c55e' : '#ef4444';
  const statusIcon = summary.totalIssues === 0 ? '✅' : '⚠️';
  const statusText = summary.totalIssues === 0 ? 'All Clean!' : `${summary.totalIssues} Issue${summary.totalIssues === 1 ? '' : 's'} Found`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Data Integrity Audit Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f9fafb;
      color: #111827;
      padding: 2rem;
      line-height: 1.6;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      background: white;
      border-radius: 8px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .header h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .header .timestamp {
      color: #6b7280;
      font-size: 0.875rem;
    }
    .status-banner {
      background: ${statusColor};
      color: white;
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 2rem;
      text-align: center;
      font-size: 1.25rem;
      font-weight: 600;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .summary-card {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .summary-card .label {
      color: #6b7280;
      font-size: 0.875rem;
      margin-bottom: 0.5rem;
    }
    .summary-card .value {
      font-size: 2rem;
      font-weight: 700;
      color: #111827;
    }
    .summary-card.issues .value {
      color: ${summary.totalIssues > 0 ? '#ef4444' : '#22c55e'};
    }
    .summary-card.fixed .value {
      color: #8b5cf6;
    }
    .controls {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .btn {
      padding: 0.75rem 1.5rem;
      border-radius: 6px;
      border: none;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
      transition: all 0.2s;
    }
    .btn-primary {
      background: #8b5cf6;
      color: white;
    }
    .btn-primary:hover {
      background: #7c3aed;
    }
    .btn-danger {
      background: #ef4444;
      color: white;
    }
    .btn-danger:hover {
      background: #dc2626;
    }
    .btn-secondary {
      background: #e5e7eb;
      color: #111827;
    }
    .btn-secondary:hover {
      background: #d1d5db;
    }
    .program {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .program.passed {
      border-left: 4px solid #22c55e;
    }
    .program.failed {
      border-left: 4px solid #ef4444;
    }
    .program-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }
    .program-title {
      font-size: 1.25rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .badge {
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge-success {
      background: #dcfce7;
      color: #166534;
    }
    .badge-danger {
      background: #fee2e2;
      color: #991b1b;
    }
    .badge-warning {
      background: #fef3c7;
      color: #92400e;
    }
    .badge-info {
      background: #dbeafe;
      color: #1e40af;
    }
    .program-details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
      padding: 1rem;
      background: #f9fafb;
      border-radius: 6px;
    }
    .detail-item {
      font-size: 0.875rem;
    }
    .detail-label {
      color: #6b7280;
      margin-bottom: 0.25rem;
    }
    .detail-value {
      font-weight: 600;
      color: #111827;
    }
    .issues, .warnings {
      margin-top: 1rem;
    }
    .issues h4, .warnings h4 {
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .issues h4 { color: #ef4444; }
    .warnings h4 { color: #f59e0b; }
    .issue-list, .warning-list {
      list-style: none;
      padding-left: 0;
    }
    .issue-list li, .warning-list li {
      padding: 0.5rem;
      margin-bottom: 0.25rem;
      border-radius: 4px;
      font-size: 0.875rem;
    }
    .issue-list li {
      background: #fee2e2;
      color: #7f1d1d;
    }
    .warning-list li {
      background: #fef3c7;
      color: #78350f;
    }
    .no-programs {
      background: white;
      padding: 3rem;
      border-radius: 8px;
      text-align: center;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Data Integrity Audit</h1>
      <div class="timestamp">Generated: ${new Date().toLocaleString()}</div>
    </div>

    <div class="status-banner">
      ${statusIcon} ${statusText}
    </div>

    <div class="summary">
      <div class="summary-card">
        <div class="label">Programs Checked</div>
        <div class="value">${summary.totalPrograms}</div>
      </div>
      <div class="summary-card issues">
        <div class="label">Total Issues</div>
        <div class="value">${summary.totalIssues}</div>
      </div>
      <div class="summary-card">
        <div class="label">With Issues</div>
        <div class="value">${summary.programsWithIssues}</div>
      </div>
      <div class="summary-card">
        <div class="label">With Warnings</div>
        <div class="value">${summary.programsWithWarnings}</div>
      </div>
      ${autoFix ? `
      <div class="summary-card fixed">
        <div class="label">Programs Fixed</div>
        <div class="value">${summary.totalFixed}</div>
      </div>
      ` : ''}
    </div>

    <div class="controls">
      <a href="?" class="btn btn-primary">🔄 Refresh</a>
      ${!autoFix ? `
        <span class="btn btn-secondary" style="cursor: default; opacity: 0.6;">
          🔧 Auto-Fix Issues (Disabled)
        </span>
      ` : `
        <span class="btn btn-secondary" style="cursor: default;">✅ Auto-Fix Applied</span>
      `}
      <a href="/dashboard/programs" class="btn btn-secondary">← Back to Programs</a>
    </div>

    ${results.length === 0 ? `
      <div class="no-programs">
        <h2>No programs found</h2>
      </div>
    ` : results.map(program => `
      <div class="program ${program.passed ? 'passed' : 'failed'}">
        <div class="program-header">
          <div class="program-title">
            ${program.passed ? '✅' : '⚠️'} Program #${program.programId}: ${program.programName || 'Untitled'}
          </div>
          <div>
            <span class="badge badge-info">${program.status}</span>
            ${program.passed 
              ? '<span class="badge badge-success">Passed</span>' 
              : '<span class="badge badge-danger">Failed</span>'}
          </div>
        </div>

        <div class="program-details">
          <div class="detail-item">
            <div class="detail-label">Items Cost</div>
            <div class="detail-value" style="color: ${program.issues.some((issue: string) => issue.includes('total_cost mismatch')) ? '#ef4444' : '#111827'};">$${program.calculatedValues.cost?.toFixed(2) || '0.00'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Items Charge</div>
            <div class="detail-value" style="color: ${program.issues.some((issue: string) => issue.includes('total_charge mismatch')) ? '#ef4444' : '#111827'};">$${program.calculatedValues.charge?.toFixed(2) || '0.00'}</div>
          </div>
              <div class="detail-item">
                <div class="detail-label">Taxes</div>
                <div class="detail-value" style="color: ${program.issues.some((issue: string) => issue.includes('taxes mismatch')) ? '#ef4444' : '#111827'};">$${program.storedValues.taxes?.toFixed(2) || '0.00'}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Finance Charges</div>
                <div class="detail-value" style="color: #111827;">$${program.storedValues.financeCharges?.toFixed(2) || '0.00'}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Discounts</div>
                <div class="detail-value" style="color: #111827;">$${program.storedValues.discounts?.toFixed(2) || '0.00'}</div>
              </div>
          <div class="detail-item">
            <div class="detail-label">Projected Price</div>
            <div class="detail-value">$${program.calculatedValues.projectedPrice?.toFixed(2) || '0.00'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">${program.status === 'Active' ? 'Locked Price' : 'Final Total Price'}</div>
            <div class="detail-value" style="font-weight: 700; color: ${program.issues.some((issue: string) => issue.includes('final_total_price mismatch')) ? '#ef4444' : (program.status === 'Active' ? '#8b5cf6' : '#111827')};">$${program.storedValues.lockedPrice?.toFixed(2) || '0.00'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Variance</div>
            <div class="detail-value" style="color: ${program.issues.some((issue: string) => issue.includes('variance mismatch')) ? '#ef4444' : ((program.storedValues.variance || 0) < 0 ? '#22c55e' : ((program.storedValues.variance || 0) > 0 ? '#ef4444' : '#111827'))};">$${program.storedValues.variance?.toFixed(2) || '0.00'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Stored Margin</div>
            <div class="detail-value" style="color: ${program.issues.some((issue: string) => issue.includes('margin mismatch') || issue.includes('stored margin differs from contracted margin')) ? '#ef4444' : '#111827'};">${program.storedValues.margin?.toFixed(2) || '0.00'}%</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Calculated Margin</div>
            <div class="detail-value" style="color: ${program.issues.some((issue: string) => issue.includes('margin mismatch') || issue.includes('calculated margin differs from contracted margin')) ? '#ef4444' : '#111827'};">${program.calculatedValues.projectedMargin?.toFixed(2) || '0.00'}%</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Contracted Margin</div>
            <div class="detail-value">${program.storedValues.contractedMargin?.toFixed(2) || '0.00'}%</div>
          </div>
        </div>

        ${program.issues.length > 0 ? `
        <div class="issues">
          <h4>🚨 Issues</h4>
          <ul class="issue-list">
            ${program.issues.map((issue: string) => `<li>${issue}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        ${program.warnings.length > 0 ? `
        <div class="warnings">
          <h4>⚠️ Warnings</h4>
          <ul class="warning-list">
            ${program.warnings.map((warning: string) => `<li>${warning}</li>`).join('')}
          </ul>
        </div>
        ` : ''}
      </div>
    `).join('')}
  </div>
</body>
</html>
  `;
}


