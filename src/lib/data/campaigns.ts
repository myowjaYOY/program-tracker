import { createClient } from '@/lib/supabase/server';
import { Campaigns } from '@/types/database.types';

export async function getCampaigns(): Promise<Campaigns[]> {
    const supabase = await createClient();

    try {
        const { data, error } = await supabase
            .from('campaigns')
            .select('*')
            .order('campaign_name');

        if (error) {
            console.error('Error fetching campaigns:', error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error('Error in getCampaigns:', error);
        return [];
    }
}
