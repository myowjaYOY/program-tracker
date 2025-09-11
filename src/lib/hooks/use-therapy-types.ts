import { useQuery } from '@tanstack/react-query';
import { TherapyType } from '@/types/database.types';

const therapyTypeKeys = {
  all: ['therapy-types'] as const,
  list: () => [...therapyTypeKeys.all, 'list'] as const,
  active: () => [...therapyTypeKeys.all, 'active'] as const,
};

export function useTherapyTypes() {
  return useQuery<TherapyType[], Error>({
    queryKey: therapyTypeKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/therapy-types');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch therapy types');
      return json.data as TherapyType[];
    },
  });
}

export function useActiveTherapyTypes() {
  return useQuery<TherapyType[], Error>({
    queryKey: therapyTypeKeys.active(),
    queryFn: async () => {
      const res = await fetch('/api/therapy-types');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch therapy types');
      return (json.data as TherapyType[]).filter(t => t.active_flag);
    },
  });
}


