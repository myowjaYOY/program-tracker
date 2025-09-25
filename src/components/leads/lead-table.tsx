'use client';

import React, { useState } from 'react';
import { GridColDef } from '@mui/x-data-grid';
import { Box, IconButton, Chip, Tooltip } from '@mui/material';
import BaseDataTable, {
  commonColumns,
  renderDate,
} from '@/components/tables/base-data-table';
import LeadForm from '@/components/forms/lead-form';
import { useLeads, useDeleteLead } from '@/lib/hooks/use-leads';
import { Leads } from '@/types/database.types';
import { LeadFormData } from '@/lib/validations/lead';
import EditNoteIcon from '@mui/icons-material/EditNote';
import { LeadNotesModal } from '@/components/notes';

// Extend Leads to satisfy BaseEntity interface
interface LeadEntity extends Omit<Leads, 'created_at' | 'updated_at'> {
  id: string | number;
  created_at: string;
  updated_at: string;
  status_name?: string; // Add status name for display
  campaign_name?: string; // Add campaign name for display
  note_count?: number; // Add note count for display
}

// Lead-specific columns
const leadColumns: GridColDef[] = [
  {
    field: 'notes',
    headerName: 'Note',
    width: 80,
    sortable: false,
    renderCell: (params) => {
      const row = params.row as any;
      const noteCount = row.note_count || 0;
      const leadName = `${row.first_name || ''} ${row.last_name || ''}`.trim() || `Lead #${row.lead_id}`;
      const leadId = row.lead_id;
      
      if (!leadId) return null;
      
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Tooltip title={`View/Add Notes for ${leadName}`}>
            <IconButton
              size="small"
              onClick={() => {
                // This will be handled by the component
                (window as any).openLeadNotesModal?.(leadId, leadName);
              }}
              sx={{ 
                color: noteCount > 0 ? 'primary.main' : 'text.secondary',
                '&:hover': { 
                  backgroundColor: 'primary.50',
                  color: 'primary.main'
                }
              }}
            >
              <EditNoteIcon fontSize="small" />
              {noteCount > 0 && (
                <Chip
                  label={noteCount}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    height: 16,
                    minWidth: 16,
                    fontSize: '0.7rem',
                    '& .MuiChip-label': {
                      px: 0.5,
                    },
                  }}
                />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      );
    },
  },
  {
    field: 'first_name',
    headerName: 'First Name',
    width: 150,
    flex: 1,
  },
  {
    field: 'last_name',
    headerName: 'Last Name',
    width: 150,
    flex: 1,
  },
  {
    field: 'pmedate',
    headerName: 'PME Date',
    width: 120,
    renderCell: renderDate,
  },
  {
    field: 'email',
    headerName: 'Email',
    width: 200,
    flex: 1,
  },
  {
    field: 'phone',
    headerName: 'Phone',
    width: 130,
    flex: 1,
  },
  {
    field: 'status_name',
    headerName: 'Status',
    width: 120,
    flex: 1,
  },
  {
    field: 'campaign_name',
    headerName: 'Campaign',
    width: 150,
    flex: 1,
  },
  commonColumns.activeFlag,
  commonColumns.createdAt,
  commonColumns.createdBy,
  commonColumns.updatedAt,
  commonColumns.updatedBy,
];

export default function LeadTable() {
  const { data: leads, isLoading, error } = useLeads();
  const deleteLead = useDeleteLead();

  // Notes modal state
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const handleDelete = (id: string | number) => {
    deleteLead.mutate(String(id));
  };

  const handleEdit = (_row: LeadEntity) => {
    // The edit functionality is handled by the BaseDataTable component
    // which will open the form modal with the row data
  };

  const handleOpenNotesModal = (leadId: number, leadName: string) => {
    setSelectedLead({ id: leadId, name: leadName });
    setIsNotesModalOpen(true);
  };

  const handleCloseNotesModal = () => {
    setIsNotesModalOpen(false);
    setSelectedLead(null);
  };

  // Make the modal handler available to the column renderer
  React.useEffect(() => {
    (window as any).openLeadNotesModal = handleOpenNotesModal;
    return () => {
      delete (window as any).openLeadNotesModal;
    };
  }, []);

  const renderLeadForm = ({
    open,
    onClose,
    initialValues,
    mode,
  }: {
    open: boolean;
    onClose: () => void;
    initialValues?: Partial<LeadEntity>;
    mode: 'create' | 'edit';
  }) => {
    if (!open) return null;
    const formData: Partial<LeadFormData> & { lead_id?: number } = initialValues
      ? {
          first_name: initialValues.first_name || '',
          last_name: initialValues.last_name || '',
          email: initialValues.email || '',
          phone: initialValues.phone || '',
          status_id: initialValues.status_id || 0,
          campaign_id: initialValues.campaign_id || 0,
          pmedate: initialValues.pmedate || '',
          active_flag: initialValues.active_flag ?? true,
          ...(initialValues.lead_id && { lead_id: initialValues.lead_id }),
        }
      : {};
    return (
      <LeadForm initialValues={formData} onSuccess={onClose} mode={mode} />
    );
  };

  const leadsWithId: LeadEntity[] = (leads || []).map(lead => ({
    ...lead,
    id: lead.lead_id,
    created_at: lead.created_at || new Date().toISOString(),
    updated_at: lead.updated_at || new Date().toISOString(),
    created_by: (lead as any).created_by_email || '-',
    updated_by: (lead as any).updated_by_email || '-',
  }));

  return (
    <>
      <BaseDataTable<LeadEntity>
        title="Leads"
        data={leadsWithId}
        columns={leadColumns}
        loading={isLoading}
        error={error?.message || null}
        getRowId={row => row.lead_id}
        onEdit={handleEdit}
        onDelete={handleDelete}
        renderForm={renderLeadForm}
        createButtonText="Add Lead"
        editButtonText="Edit Lead"
        deleteButtonText="Delete Lead"
        deleteConfirmMessage="Are you sure you want to delete this lead? This action cannot be undone."
        pageSize={25}
        pageSizeOptions={[10, 25, 50, 100]}
        autoHeight={false}
        gridHeight="calc(100vh - 120px)"
      />

      {/* Lead Notes Modal */}
      {selectedLead && (
        <LeadNotesModal
          open={isNotesModalOpen}
          onClose={handleCloseNotesModal}
          leadId={selectedLead.id}
          leadName={selectedLead.name}
        />
      )}
    </>
  );
}
