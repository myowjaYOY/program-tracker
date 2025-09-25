'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Box,
  Divider,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import NoteForm from './note-form';
import NotesHistoryGrid from './notes-history-grid';

interface LeadNotesModalProps {
  open: boolean;
  onClose: () => void;
  leadId: number;
  leadName: string;
}

export default function LeadNotesModal({
  open,
  onClose,
  leadId,
  leadName,
}: LeadNotesModalProps) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleNoteAdded = () => {
    // Trigger refresh of the history grid
    setRefreshTrigger(prev => prev + 1);
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          height: '80vh',
          maxHeight: '80vh',
          borderRadius: 2,
          margin: { xs: 2, sm: 'auto' },
          width: { xs: 'calc(100% - 32px)', sm: 'auto' },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 1,
        }}
      >
        <Typography variant="h6" component="div">
          Add Note to {leadName}
        </Typography>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          p: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Form Section - Top 40% */}
        <Box sx={{ flex: '0 0 auto' }}>
          <NoteForm
            leadId={leadId}
            onSuccess={handleNoteAdded}
          />
        </Box>

        {/* Divider */}
        <Divider />

        {/* History Section - Bottom 60% */}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <NotesHistoryGrid
            leadId={leadId}
            onRefresh={refreshTrigger}
          />
        </Box>
      </DialogContent>

    </Dialog>
  );
}
