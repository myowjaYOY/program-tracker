'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  TextField,
  Divider,
  alpha,
  IconButton,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  AccessTime as AccessTimeIcon,
  Person as PersonIcon,
  Close as CloseIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { formatDistanceToNow, format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Notification, useAcknowledgeNotification } from '@/lib/hooks/use-notifications';
import { useCreateLeadNote } from '@/lib/hooks/use-lead-notes';

/**
 * System User UUID for automated notifications
 */
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Tab mapping for system-generated alerts
 * Maps alert title to Report Card tab index
 */
const SYSTEM_ALERT_TABS: Record<string, number> = {
  'Member is behind on their education': 0, // Member Progress
  'Feedback Provided': 4,                   // Member Feedback
};

interface NotificationDetailModalProps {
  open: boolean;
  onClose: () => void;
  notification: Notification | null;
}

const getPriorityConfig = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return {
        icon: <ErrorIcon />,
        color: 'error' as const,
        label: 'URGENT',
        bgcolor: 'error.main',
      };
    case 'high':
      return {
        icon: <WarningIcon />,
        color: 'warning' as const,
        label: 'HIGH PRIORITY',
        bgcolor: 'warning.main',
      };
    default:
      return {
        icon: <InfoIcon />,
        color: 'info' as const,
        label: 'NORMAL',
        bgcolor: 'info.main',
      };
  }
};

type NoteType = 'Challenge' | 'Follow-Up' | 'Other' | 'PME' | 'Win';

const NOTE_TYPES: { value: NoteType; label: string }[] = [
  { value: 'Follow-Up', label: 'Follow-Up' },
  { value: 'Challenge', label: 'Challenge' },
  { value: 'Win', label: 'Win' },
  { value: 'Other', label: 'Other' },
];

export default function NotificationDetailModal({
  open,
  onClose,
  notification,
}: NotificationDetailModalProps) {
  const [acknowledgmentNote, setAcknowledgmentNote] = useState('');
  const [noteType, setNoteType] = useState<NoteType>('Follow-Up');
  
  const router = useRouter();
  const createNote = useCreateLeadNote();
  const acknowledgeNotification = useAcknowledgeNotification();
  
  const isAcknowledging = createNote.isPending || acknowledgeNotification.isPending;

  if (!notification) return null;

  const priorityConfig = getPriorityConfig(notification.priority);
  const isAcknowledged = notification.status === 'acknowledged';
  const memberName = notification.lead 
    ? `${notification.lead.first_name} ${notification.lead.last_name}`
    : 'Unknown Member';
  
  // Check if this is a system-generated alert that can navigate to Report Card
  const isSystemAlert = notification.created_by === SYSTEM_USER_ID;
  const targetTab = SYSTEM_ALERT_TABS[notification.title] ?? 0;
  const showReportCardButton = isSystemAlert && notification.lead_id;

  const handleViewReportCard = () => {
    router.push(`/dashboard/report-card?leadId=${notification.lead_id}&tab=${targetTab}`);
    onClose();
  };

  const handleAcknowledge = async () => {
    if (!acknowledgmentNote.trim()) return;
    
    try {
      // First create the note
      const newNote = await createNote.mutateAsync({
        lead_id: notification.lead_id,
        note_type: noteType,
        note: acknowledgmentNote,
      });
      
      // Then acknowledge the notification with the note ID
      await acknowledgeNotification.mutateAsync({
        notification_id: notification.notification_id,
        response_note_id: newNote.note_id,
      });
      
      setAcknowledgmentNote('');
      setNoteType('Follow-Up');
      onClose();
    } catch (error) {
      // Errors handled by mutation hooks
    }
  };

  const handleClose = () => {
    setAcknowledgmentNote('');
    setNoteType('Follow-Up');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          overflow: 'hidden',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Header with priority color */}
      <Box
        sx={{
          bgcolor: priorityConfig.bgcolor,
          color: 'white',
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        {priorityConfig.icon}
        <Box sx={{ flex: 1 }}>
          <Typography variant="overline" sx={{ opacity: 0.9, display: 'block', lineHeight: 1 }}>
            {priorityConfig.label}
          </Typography>
          <Typography variant="h6" fontWeight="bold">
            {notification.title}
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

      <DialogContent sx={{ pt: 3, flex: 1, overflow: 'auto' }}>
        {/* TODO: Remove duplicate message display once notifications.message 
            field is no longer populated (see process-feedback-alerts TODO).
            Currently notification.message duplicates source_note content. */}
        
        {/* Metadata */}
        <Box
          sx={{
            bgcolor: 'grey.50',
            borderRadius: 1,
            p: 2,
            mb: 3,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <PersonIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              Member: <strong>{memberName}</strong>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <AccessTimeIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
              {' '}({format(new Date(notification.created_at), 'MMM d, yyyy h:mm a')})
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              Created by: <strong>
                {notification.created_by === '00000000-0000-0000-0000-000000000000' 
                  ? 'System' 
                  : (notification.creator?.full_name || notification.creator?.email || 'Unknown')}
              </strong>
            </Typography>
          </Box>
        </Box>

        {/* Source Note */}
        {notification.source_note && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold">
                Original Note
              </Typography>
              {showReportCardButton && (
                <Tooltip title="View in Report Card">
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={handleViewReportCard}
                    sx={{ ml: 0.5 }}
                  >
                    <AssessmentIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
            <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1, borderLeft: 3, borderColor: 'primary.main' }}>
              <Chip label={notification.source_note.note_type} size="small" sx={{ mb: 1 }} />
              <Typography variant="body2">{notification.source_note.note}</Typography>
            </Box>
          </Box>
        )}

        {/* Acknowledgment Status or Form */}
        {isAcknowledged ? (
          <Box
            sx={{
              bgcolor: alpha('#4caf50', 0.1),
              border: 1,
              borderColor: 'success.main',
              borderRadius: 1,
              p: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <CheckCircleIcon color="success" />
              <Typography variant="subtitle2" color="success.main" fontWeight="bold">
                Acknowledged
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              by <strong>{notification.acknowledger?.full_name || 'Unknown'}</strong>
              {notification.acknowledged_at && (
                <> on {format(new Date(notification.acknowledged_at), 'MMM d, yyyy h:mm a')}</>
              )}
            </Typography>
            {notification.response_note && (
              <Box sx={{ mt: 2, bgcolor: 'white', p: 2, borderRadius: 1 }}>
                <Chip label={notification.response_note.note_type} size="small" sx={{ mb: 1 }} />
                <Typography variant="body2">{notification.response_note.note}</Typography>
              </Box>
            )}
          </Box>
        ) : (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5 }}>
              Acknowledge this notification
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              You must add a note when acknowledging. This note will be saved to the member's record.
            </Typography>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Note Type</InputLabel>
              <Select
                value={noteType}
                onChange={(e) => setNoteType(e.target.value as NoteType)}
                label="Note Type"
              >
                {NOTE_TYPES.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Acknowledgment Note"
              placeholder="e.g., 'Called patient, scheduled follow-up for next week'"
              multiline
              rows={3}
              fullWidth
              required
              value={acknowledgmentNote}
              onChange={(e) => setAcknowledgmentNote(e.target.value)}
              error={!acknowledgmentNote.trim() && acknowledgmentNote.length > 0}
              helperText="Required - describe the action taken"
            />
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
        <Button onClick={handleClose} sx={{ borderRadius: 0 }}>
          Close
        </Button>
        {!isAcknowledged && (
          <Button
            variant="contained"
            color="success"
            onClick={handleAcknowledge}
            disabled={isAcknowledging || !acknowledgmentNote.trim()}
            startIcon={isAcknowledging ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
            sx={{ borderRadius: 0, fontWeight: 'bold' }}
          >
            {isAcknowledging ? 'Acknowledging...' : 'Acknowledge'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
