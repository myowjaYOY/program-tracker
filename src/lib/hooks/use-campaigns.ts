import { createEntityHooks } from '@/lib/hooks/create-entity-hooks';
import type { Campaigns } from '@/types/database.types';
import type { CampaignFormData } from '@/lib/validations/campaign';

const hooks = createEntityHooks<Campaigns, CampaignFormData, Partial<CampaignFormData>, string | number>({
    entityName: 'Campaign',
    endpoint: '/api/campaigns',
    queryKey: 'campaigns',
    idField: 'campaign_id',
});

export const campaignKeys = hooks.keys;
export const useCampaigns = (options?: { initialData?: Campaigns[] | undefined }) => hooks.useList(options);
export const useActiveCampaigns = hooks.useActive;
export const useCampaignDetail = hooks.useDetail;
export const useCreateCampaign = hooks.useCreate;
export const useUpdateCampaign = hooks.useUpdate;
export const useDeleteCampaign = hooks.useDelete;
