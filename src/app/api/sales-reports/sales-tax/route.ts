import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/sales-reports/sales-tax
 * 
 * Returns sales tax report data based on redemption date.
 * Shows redeemed items with calculated sales tax (8.25% on taxable items).
 * Discounts are prorated across items before tax calculation.
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

  const { searchParams } = new URL(req.url);
  const range = searchParams.get('range') || 'all';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    // Build date filter
    let dateFilter = '';
    if (range === 'custom' && startDate && endDate) {
      dateFilter = `AND s.scheduled_date >= '${startDate}' AND s.scheduled_date <= '${endDate}'`;
    } else if (range === 'this_month') {
      dateFilter = `AND s.scheduled_date >= date_trunc('month', CURRENT_DATE) AND s.scheduled_date <= CURRENT_DATE`;
    } else if (range === 'last_month') {
      dateFilter = `AND s.scheduled_date >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month') AND s.scheduled_date < date_trunc('month', CURRENT_DATE)`;
    } else if (range === 'this_year') {
      dateFilter = `AND s.scheduled_date >= date_trunc('year', CURRENT_DATE) AND s.scheduled_date <= CURRENT_DATE`;
    } else if (range === 'last_year') {
      dateFilter = `AND s.scheduled_date >= date_trunc('year', CURRENT_DATE - INTERVAL '1 year') AND s.scheduled_date < date_trunc('year', CURRENT_DATE)`;
    }

    // Query redeemed items with all necessary data for tax calculation
    const { data: rawData, error } = await supabase
      .from('member_program_item_schedule')
      .select(`
        member_program_item_schedule_id,
        scheduled_date,
        completed_flag,
        member_program_items (
          member_program_item_id,
          item_charge,
          member_programs (
            member_program_id,
            total_charge,
            leads (
              first_name,
              last_name
            ),
            member_program_finances (
              discounts
            )
          ),
          therapies (
            therapy_id,
            therapy_name,
            taxable
          )
        )
      `)
      .eq('completed_flag', true)
      .order('scheduled_date', { ascending: false });

    if (error) {
      console.error('Error fetching sales tax data:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Helper to format date as YYYY-MM-DD
    const formatDate = (date: Date): string => date.toISOString().slice(0, 10);

    // Apply date filtering in JavaScript (since we used Supabase query builder)
    let filteredData = rawData || [];
    if (range === 'custom' && startDate && endDate) {
      filteredData = filteredData.filter((item: any) => {
        const date = item.scheduled_date;
        return date >= startDate && date <= endDate;
      });
    } else if (range === 'this_month') {
      const now = new Date();
      const firstOfMonth = formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
      filteredData = filteredData.filter((item: any) => item.scheduled_date >= firstOfMonth);
    } else if (range === 'last_month') {
      const now = new Date();
      const firstOfLastMonth = formatDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      const firstOfThisMonth = formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
      filteredData = filteredData.filter((item: any) => 
        item.scheduled_date >= firstOfLastMonth && item.scheduled_date < firstOfThisMonth
      );
    } else if (range === 'this_year') {
      const firstOfYear = formatDate(new Date(new Date().getFullYear(), 0, 1));
      filteredData = filteredData.filter((item: any) => item.scheduled_date >= firstOfYear);
    } else if (range === 'last_year') {
      const firstOfLastYear = formatDate(new Date(new Date().getFullYear() - 1, 0, 1));
      const firstOfThisYear = formatDate(new Date(new Date().getFullYear(), 0, 1));
      filteredData = filteredData.filter((item: any) => 
        item.scheduled_date >= firstOfLastYear && item.scheduled_date < firstOfThisYear
      );
    }

    // Transform data and calculate sales tax
    const transformedData = filteredData.map((item: any) => {
      const mpi = item.member_program_items;
      const mp = mpi?.member_programs;
      const lead = mp?.leads;
      const therapy = mpi?.therapies;
      const finance = mp?.member_program_finances?.[0];

      const unitCharge = Number(mpi?.item_charge) || 0;
      const totalCharge = Number(mp?.total_charge) || 0;
      const discounts = Math.abs(Number(finance?.discounts) || 0);
      
      // Calculate discount ratio for tax proration
      const discountRatio = totalCharge > 0 ? discounts / totalCharge : 0;
      
      // Calculate sales tax: 8.25% on taxable items after discount proration
      const salesTax = therapy?.taxable
        ? Math.round(unitCharge * (1 - discountRatio) * 0.0825 * 100) / 100
        : 0;

      return {
        id: item.member_program_item_schedule_id,
        redemption_date: item.scheduled_date,
        member_name: lead ? `${lead.first_name} ${lead.last_name}` : 'Unknown',
        product_service: therapy?.therapy_name || 'Unknown',
        taxable: therapy?.taxable || false,
        unit_charge: unitCharge,
        discount_ratio: discountRatio,
        sales_tax: salesTax,
      };
    });

    // Calculate totals
    const total_unit_charge = transformedData.reduce(
      (sum: number, item: any) => sum + item.unit_charge, 
      0
    );

    const total_taxable_after_discount = transformedData.reduce(
      (sum: number, item: any) => {
        if (item.taxable) {
          return sum + (item.unit_charge * (1 - item.discount_ratio));
        }
        return sum;
      }, 
      0
    );

    const total_sales_tax = transformedData.reduce(
      (sum: number, item: any) => sum + item.sales_tax, 
      0
    );

    return NextResponse.json({
      data: transformedData,
      totals: {
        total_unit_charge: Math.round(total_unit_charge * 100) / 100,
        total_taxable_after_discount: Math.round(total_taxable_after_discount * 100) / 100,
        total_sales_tax: Math.round(total_sales_tax * 100) / 100,
      },
    });
  } catch (e: any) {
    console.error('Error in sales-tax endpoint:', e);
    return NextResponse.json(
      { error: e?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

