import { useQuery } from '@tanstack/react-query';

export interface ActiveMember {
  lead_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  start_date: string;
  duration: number;
  has_coach: boolean;
  is_membership: boolean;
}

/**
 * Fetch all members with active programs
 */
export function useActiveMembers() {
  return useQuery<ActiveMember[]>({
    queryKey: ['active-members'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/active-members');
      if (!response.ok) {
        throw new Error('Failed to fetch active members');
      }
      const json = await response.json();
      return json.data;
    },
  });
}

