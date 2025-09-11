'use client';

import React from 'react';
import { GridColDef } from '@mui/x-data-grid';
import BaseDataTable, {
  commonColumns,
  renderCurrency,
  renderDate,
} from '@/components/tables/base-data-table';
import CampaignForm from '@/components/forms/campaign-form';
import { useCampaigns, useDeleteCampaign } from '@/lib/hooks/use-campaigns';
import { useActiveVendors } from '@/lib/hooks/use-vendors';
import { Campaigns } from '@/types/database.types';
import { CampaignFormData } from '@/lib/validations/campaign';

// Extend Campaigns to satisfy BaseEntity interface
interface CampaignEntity extends Omit<Campaigns, 'created_at' | 'updated_at'> {
  id: string | number;
  created_at: string;
  updated_at: string;
  vendor_name?: string; // Add vendor name for display
}

// Campaign-specific columns
const campaignColumns: GridColDef[] = [
  {
    field: 'campaign_id',
    headerName: 'ID',
    width: 80,
    type: 'number',
  },
  {
    field: 'campaign_name',
    headerName: 'Campaign Name',
    width: 200,
    flex: 1,
  },
  {
    field: 'campaign_date',
    headerName: 'Date',
    width: 120,
    renderCell: renderDate,
  },
  {
    field: 'description',
    headerName: 'Description',
    width: 250,
  },
  {
    field: 'confirmed_count',
    headerName: 'Confirmed',
    width: 100,
    type: 'number',
  },
  {
    field: 'vendor_name',
    headerName: 'Vendor',
    width: 150,
  },
  {
    field: 'ad_spend',
    headerName: 'Ad Spend',
    width: 120,
    renderCell: renderCurrency,
  },
  {
    field: 'food_cost',
    headerName: 'Food Cost',
    width: 120,
    renderCell: renderCurrency,
  },
  commonColumns.activeFlag,
  commonColumns.createdAt,
  commonColumns.createdBy,
  commonColumns.updatedAt,
  commonColumns.updatedBy,
];

export default function CampaignTable() {
  const { data: campaigns, isLoading, error } = useCampaigns();
  const { data: vendors = [] } = useActiveVendors();
  const deleteCampaign = useDeleteCampaign();

  const handleDelete = (id: string | number) => {
    deleteCampaign.mutate(String(id));
  };

  const handleEdit = (_row: CampaignEntity) => {
    // The edit functionality is handled by the BaseDataTable component
    // which will open the form modal with the row data
  };

  const renderCampaignForm = ({
    open,
    onClose,
    initialValues,
    mode,
  }: {
    open: boolean;
    onClose: () => void;
    initialValues?: Partial<CampaignEntity>;
    mode: 'create' | 'edit';
  }) => {
    if (!open) return null;

    // Convert CampaignEntity to CampaignFormData for the form
    const formData: Partial<CampaignFormData> & { campaign_id?: number } =
      initialValues
        ? {
            campaign_name: initialValues.campaign_name || '',
            campaign_date: initialValues.campaign_date || '',
            description: initialValues.description || '',
            confirmed_count: initialValues.confirmed_count || 0,
            vendor_id: initialValues.vendor_id || 0,
            ad_spend: initialValues.ad_spend || null,
            food_cost: initialValues.food_cost || null,
            active_flag: initialValues.active_flag || true,
            ...(initialValues.campaign_id && {
              campaign_id: initialValues.campaign_id,
            }),
          }
        : {};

    return (
      <CampaignForm initialValues={formData} onSuccess={onClose} mode={mode} />
    );
  };

  // Create vendor lookup map
  const vendorMap = new Map(vendors.map(v => [v.vendor_id, v.vendor_name]));

  // Transform campaigns data to include id property, vendor name, and handle null dates
  const campaignsWithId: CampaignEntity[] = (campaigns || []).map(campaign => ({
    ...campaign,
    id: campaign.campaign_id,
    created_at: campaign.created_at || new Date().toISOString(),
    updated_at: campaign.updated_at || new Date().toISOString(),
    created_by: campaign.created_by_email || '-',
    updated_by: campaign.updated_by_email || '-',
    vendor_name: vendorMap.get(campaign.vendor_id) || 'Unknown Vendor',
  }));

  return (
    <BaseDataTable<CampaignEntity>
      title="Campaigns"
      data={campaignsWithId}
      columns={campaignColumns}
      loading={isLoading}
      error={error?.message || null}
      getRowId={row => row.campaign_id}
      onEdit={handleEdit}
      onDelete={handleDelete}
      renderForm={renderCampaignForm}
      createButtonText="Add Campaign"
      editButtonText="Edit Campaign"
      deleteButtonText="Delete Campaign"
      deleteConfirmMessage="Are you sure you want to delete this campaign? This action cannot be undone."
      pageSize={25}
      pageSizeOptions={[10, 25, 50, 100]}
    />
  );
}
