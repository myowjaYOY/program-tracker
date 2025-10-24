import { useQuery } from '@tanstack/react-query';
import { MemberPrograms, ProgramStatus } from '@/types/database.types';

// Interface for the member dropdown data structure
export interface DashboardMember {
  lead_id: number;
  lead_name: string;
  lead_email: string | null;
  programs: MemberPrograms[];
}

const dashboardMemberProgramKeys = {
  all: ['dashboard-member-programs'] as const,
  activeAndPaused: () => [...dashboardMemberProgramKeys.all, 'active-and-paused'] as const,
  members: () => [...dashboardMemberProgramKeys.all, 'members'] as const,
};

/**
 * Hook to get member programs filtered by Active and Paused status
 * Returns programs grouped by member (lead) for dropdown selection
 */
export function useActiveAndPausedMemberPrograms() {
  return useQuery<MemberPrograms[], Error>({
    queryKey: dashboardMemberProgramKeys.activeAndPaused(),
    queryFn: async () => {
      const res = await fetch('/api/member-programs', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch member programs');
      }
      
      const allPrograms = json.data as MemberPrograms[];
      
      // Filter for Active and Paused programs only
      const filteredPrograms = allPrograms.filter(program => {
        const statusName = program.status_name?.toLowerCase();
        return statusName === 'active' || statusName === 'paused';
      });
      
      return filteredPrograms;
    },
  });
}

/**
 * Hook to get members (leads) with their active programs
 * Returns data structured for dropdown selection
 * NOTE: Filters for Active programs only (matching Coordinator and ProgramStatusService logic)
 */
export function useDashboardMembers() {
  return useQuery<DashboardMember[], Error>({
    queryKey: dashboardMemberProgramKeys.members(),
    queryFn: async () => {
      const res = await fetch('/api/member-programs', {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to fetch member programs');
      }
      
      const allPrograms = json.data as MemberPrograms[];
      
      // Filter for Active programs only (matching Coordinator logic and ProgramStatusService)
      const filteredPrograms = allPrograms.filter(program => {
        const statusName = program.status_name?.toLowerCase();
        return statusName === 'active';
      });
      
      // Group programs by lead (member)
      const memberMap = new Map<number, DashboardMember>();
      
      filteredPrograms.forEach(program => {
        if (!program.lead_id || !program.lead_name) return;
        
        const leadId = program.lead_id;
        
        if (!memberMap.has(leadId)) {
          memberMap.set(leadId, {
            lead_id: leadId,
            lead_name: program.lead_name,
            lead_email: program.lead_email || null,
            programs: [],
          });
        }
        
        memberMap.get(leadId)!.programs.push(program);
      });
      
      // Convert map to array and sort by lead name
      const members = Array.from(memberMap.values()).sort((a, b) => 
        a.lead_name.localeCompare(b.lead_name)
      );
      
      return members;
    },
  });
}
