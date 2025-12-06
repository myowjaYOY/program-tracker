'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Box,
  Divider,
  Button,
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
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Colored Header */}
      <Box
        sx={{
          bgcolor: 'primary.main',
          color: 'white',
          px: 3,
          py: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box>
          <Typography variant="overline" sx={{ opacity: 0.9, display: 'block', lineHeight: 1 }}>
            NEW
          </Typography>
          <Typography variant="h6" fontWeight="bold">
            {leadName}
          </Typography>
        </Box>
        <IconButton 
          onClick={handleClose} 
          size="small"
          sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent
        sx={{
          p: 0,
          flex: 1,
          overflow: 'auto',
        }}
      >
        {/* Form Section */}
        <Box sx={{ px: 2, pt: 2, pb: 1 }}>
          <NoteForm
            leadId={leadId}
            onSuccess={handleNoteAdded}
            hideButtons
            formId="note-form"
          />
        </Box>

        {/* History Section */}
        <Box sx={{ minHeight: 300 }}>
          <NotesHistoryGrid
            leadId={leadId}
            onRefresh={refreshTrigger}
          />
        </Box>
      </DialogContent>

      {/* Fixed Footer with Action Buttons */}
      <DialogActions 
        sx={{ 
          px: 3, 
          py: 2, 
          borderTop: 1, 
          borderColor: 'divider',
          bgcolor: 'grey.50',
        }}
      >
        <Button 
          onClick={handleClose}
          sx={{ borderRadius: 0 }}
        >
          Close
        </Button>
        <Button
          type="submit"
          form="note-form"
          variant="contained"
          color="primary"
          sx={{ borderRadius: 0, fontWeight: 600, minWidth: 120 }}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
