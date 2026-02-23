import { createClient } from '@/lib/supabase/server';
import { Vendors } from '@/types/database.types';

export async function getVendors(): Promise<Vendors[]> {
    const supabase = await createClient();

    try {
        const { data, error } = await supabase
            .from('vendors')
            .select('*')
            .order('vendor_name');

        if (error) {
            console.error('Error fetching vendors:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Error in getVendors:', error);
        return [];
    }
}
