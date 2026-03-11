'use client';

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Box,
  DialogProps,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

export interface BaseModalProps extends Omit<DialogProps, 'title'> {
  /** Title of the modal */
  title: React.ReactNode;
  /** Optional subtitle displayed below the title */
  subtitle?: React.ReactNode;
  /** Controls if the modal is open */
  open: boolean;
  /** Handler called when the modal is closed */
  onClose: () => void;
  /** Action buttons rendered in the DialogActions area */
  actions?: React.ReactNode;
  /** If true, the dialog content will have dividers (borders top and bottom) */
  dividers?: boolean;
  /** Custom children for DialogContent */
  children?: React.ReactNode;
  /** Disable the close IconButton */
  disableCloseButton?: boolean;
}

/**
 * A reusable modal component standardizing the layout of MUI Dialogs.
 * Includes a consistent header with an optional close button and subtitle.
 */
export default function BaseModal({
  title,
  subtitle,
  open,
  onClose,
  actions,
  dividers = false,
  children,
  disableCloseButton = false,
  maxWidth = 'sm',
  fullWidth = true,
  ...rest
}: BaseModalProps) {
  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth={maxWidth} 
      fullWidth={fullWidth}
      {...rest}
    >
      <DialogTitle sx={{ pr: disableCloseButton ? undefined : 6 }}>
        {typeof title === 'string' ? (
          <Typography variant="h6" component="div">
            {title}
          </Typography>
        ) : (
          title
        )}
        
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
        
        {!disableCloseButton && (
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>

      {children && (
        <DialogContent dividers={dividers}>
          {children}
        </DialogContent>
      )}

      {actions && (
        <DialogActions sx={{ px: 3, py: 2 }}>
          {actions}
        </DialogActions>
      )}
    </Dialog>
  );
}
