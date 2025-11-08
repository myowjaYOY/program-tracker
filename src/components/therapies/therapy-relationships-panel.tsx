'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Chip,
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { TherapiesBodiesPillars } from '@/types/database.types';
import {
  useTherapyRelationships,
  useDeleteTherapyRelationship,
} from '@/lib/hooks/use-therapy-relationships';
import TherapyRelationshipForm from '@/components/forms/therapy-relationship-form';

interface TherapyRelationshipsPanelProps {
  therapyId: string;
}

export default function TherapyRelationshipsPanel({
  therapyId,
}: TherapyRelationshipsPanelProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [relationshipToDelete, setRelationshipToDelete] = useState<{ bodyId: number; pillarId: number } | null>(null);
  
  const {
    data: relationships = [],
    isLoading,
    error,
  } = useTherapyRelationships(therapyId);
  const deleteRelationship = useDeleteTherapyRelationship(therapyId);

  const handleDelete = (bodyId: number, pillarId: number) => {
    setRelationshipToDelete({ bodyId, pillarId });
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (relationshipToDelete) {
      deleteRelationship.mutate({
        bodyId: String(relationshipToDelete.bodyId),
        pillarId: String(relationshipToDelete.pillarId),
      });
      setDeleteConfirmOpen(false);
      setRelationshipToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmOpen(false);
    setRelationshipToDelete(null);
  };

  const handleAddSuccess = () => {
    setIsAddDialogOpen(false);
  };

  if (isLoading) {
    return <Typography>Loading relationships...</Typography>;
  }

  if (error) {
    return (
      <Typography color="error">
        Error loading relationships: {error.message}
      </Typography>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography variant="h6">Bodies & Pillars</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setIsAddDialogOpen(true)}
          disabled={relationships.length >= 10}
        >
          Add Relationship
        </Button>
      </Box>

      {relationships.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No relationships found. Click "Add Relationship" to get started.
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Body</TableCell>
                <TableCell>Pillar</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell>Created At</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {relationships.map(relationship => (
                <TableRow
                  key={`${relationship.therapy_id}-${relationship.body_id}-${relationship.pillar_id}`}
                >
                  <TableCell>
                    <Chip
                      label={relationship.body_name || 'Unknown'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={relationship.pillar_name || 'Unknown'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{relationship.created_by_email || '-'}</TableCell>
                  <TableCell>
                    {relationship.created_at
                      ? new Date(relationship.created_at).toLocaleDateString()
                      : '-'}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() =>
                        handleDelete(
                          relationship.body_id,
                          relationship.pillar_id
                        )
                      }
                      disabled={deleteRelationship.isPending}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Body & Pillar Relationship</DialogTitle>
        <DialogContent>
          <TherapyRelationshipForm
            therapyId={therapyId}
            onSuccess={handleAddSuccess}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setIsAddDialogOpen(false)}
            sx={{ borderRadius: 0 }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={handleCancelDelete}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete Relationship</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this Body & Pillar relationship? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCancelDelete}
            color="primary"
            sx={{ borderRadius: 0 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            sx={{ borderRadius: 0 }}
            disabled={deleteRelationship.isPending}
          >
            {deleteRelationship.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
