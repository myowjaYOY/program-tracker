import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Vendors } from '@/types/database.types';
import { VendorFormData, VendorUpdateData } from '@/lib/validations/vendor';

const vendorKeys = {
  all: ['vendors'] as const,
  list: () => [...vendorKeys.all, 'list'] as const,
  active: () => [...vendorKeys.all, 'active'] as const,
  detail: (id: string) => [...vendorKeys.all, 'detail', id] as const,
};

export function useVendors() {
  return useQuery<Vendors[], Error>({
    queryKey: vendorKeys.list(),
    queryFn: async () => {
      const res = await fetch('/api/vendors');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch vendors');
      return json.data as Vendors[];
    },
  });
}

export function useActiveVendors() {
  return useQuery<Vendors[], Error>({
    queryKey: vendorKeys.active(),
    queryFn: async () => {
      const res = await fetch('/api/vendors');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch vendors');
      return (json.data as Vendors[]).filter(v => v.active_flag);
    },
  });
}

export function useCreateVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: VendorFormData) => {
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create vendor');
      return json.data as Vendors;
    },
    onSuccess: () => {
      toast.success('Vendor created');
      queryClient.invalidateQueries({ queryKey: vendorKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create vendor');
    },
  });
}

export function useUpdateVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: VendorUpdateData) => {
      const res = await fetch(`/api/vendors/${input.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update vendor');
      return json.data as Vendors;
    },
    onSuccess: () => {
      toast.success('Vendor updated');
      queryClient.invalidateQueries({ queryKey: vendorKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update vendor');
    },
  });
}

export function useDeleteVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/vendors/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete vendor');
      return id;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: vendorKeys.all });
      const prev = queryClient.getQueryData<Vendors[]>(vendorKeys.list());
      if (prev) {
        queryClient.setQueryData(
          vendorKeys.list(),
          prev.filter(v => v.vendor_id !== parseInt(id))
        );
      }
      return { prev };
    },
    onError: (err: Error, id, context) => {
      toast.error(err.message || 'Failed to delete vendor');
      if (context?.prev) {
        queryClient.setQueryData(vendorKeys.list(), context.prev);
      }
    },
    onSuccess: () => {
      toast.success('Vendor deleted');
      queryClient.invalidateQueries({ queryKey: vendorKeys.all });
    },
  });
}
