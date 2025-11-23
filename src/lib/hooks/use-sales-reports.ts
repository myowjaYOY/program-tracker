import { useQuery } from '@tanstack/react-query';

export const salesReportKeys = {
  all: ['sales-reports'] as const,
  executiveDashboard: (filters: DateRangeFilter) => 
    [...salesReportKeys.all, 'executive-dashboard', filters] as const,
  monthlySales: (filters: DateRangeFilter) =>
    [...salesReportKeys.all, 'monthly-sales', filters] as const,
};

export interface DateRangeFilter {
  range: 'all' | 'this_year' | 'last_year' | 'this_month' | 'last_month' | 
         'this_quarter' | 'last_quarter' | 'custom';
  startDate?: string | null;
  endDate?: string | null;
}

export interface ExecutiveDashboardSummary {
  totalRevenue: number;
  pipelineValue: number;
  avgProgramValue: number;
  avgMargin: number;
  conversionRate: number;
}

export interface CampaignMetrics {
  id: string;
  campaign_id: number;
  campaign_name: string;
  campaign_date: string;
  campaign_status: 'Active' | 'Closed' | 'Mixed';
  pme_scheduled: number;
  pme_no_shows: number;
  programs_won: number;
  pme_win_percentage: number;
  campaign_cost: number;
  cost_per_customer: number;
  total_revenue: number;
  roi_percentage: number;
}

export interface ExecutiveDashboardData {
  summary: ExecutiveDashboardSummary;
  revenueByCampaign: CampaignMetrics[];
}

export interface MonthlySalesData {
  month: string;
  conversionRate: number;
  pmeWinRate: number;
  totalRevenue: number;
}

export function useExecutiveDashboard(filters: DateRangeFilter) {
  return useQuery<{ data: ExecutiveDashboardData }, Error>({
    queryKey: salesReportKeys.executiveDashboard(filters),
    queryFn: async () => {
      const params = new URLSearchParams({ range: filters.range });
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      
      const response = await fetch(
        `/api/sales-reports/executive-dashboard?${params}`,
        { credentials: 'include' }
      );
      if (!response.ok) {
        throw new Error('Failed to fetch executive dashboard data');
      }
      return response.json();
    },
  });
}

export function useMonthlySales(filters: DateRangeFilter) {
  return useQuery<{ data: MonthlySalesData[] }, Error>({
    queryKey: salesReportKeys.monthlySales(filters),
    queryFn: async () => {
      const params = new URLSearchParams({ range: filters.range });
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      
      const response = await fetch(
        `/api/sales-reports/monthly-sales?${params}`,
        { credentials: 'include' }
      );
      if (!response.ok) {
        throw new Error('Failed to fetch monthly sales data');
      }
      return response.json();
    },
  });
}

