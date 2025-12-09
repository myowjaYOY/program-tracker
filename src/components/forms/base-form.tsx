'use client';

import React from 'react';
import { Box, Button, Grid, Typography, CircularProgress } from '@mui/material';

interface BaseFormProps<T> {
  onSubmit: (values: T) => void | Promise<void>;
  onCancel?: (() => void) | undefined;
  isSubmitting?: boolean;
  submitText?: string;
  children: React.ReactNode;
  submitHandler?: (e: React.FormEvent<HTMLFormElement>) => void;
  buttonContainerSx?: object;
}

export function BaseForm<T>({
  onSubmit: _onSubmit,
  onCancel,
  isSubmitting = false,
  submitText = 'Submit',
  children,
  submitHandler,
  buttonContainerSx,
}: BaseFormProps<T>) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitHandler) {
      submitHandler(e);
    }
  };

  return (
    <Box 
      component="form" 
      onSubmit={handleSubmit} 
      sx={{ 
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        flex: 1,
      }}
    >
      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, px: 3, pt: 2 }}>
        <Grid container spacing={2} mb={2}>
          {children}
        </Grid>
      </Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 2,
          bgcolor: 'grey.50',
          borderTop: 1,
          borderColor: 'divider',
          pt: 2,
          pb: 2,
          px: 3,
          flexShrink: 0,
          ...buttonContainerSx,
        }}
      >
        {onCancel && (
          <Button
            variant="outlined"
            color="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
            sx={{ minWidth: 100, borderRadius: 0 }}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={isSubmitting}
          sx={{ minWidth: 120, fontWeight: 600, borderRadius: 0 }}
        >
          {isSubmitting ? (
            <CircularProgress size={22} color="inherit" />
          ) : (
            submitText
          )}
        </Button>
      </Box>
    </Box>
  );
}

export default BaseForm;
