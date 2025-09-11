'use client';

import React from 'react';
import { Box, Button, Grid, Typography, CircularProgress } from '@mui/material';

interface BaseFormProps<T> {
  onSubmit: (values: T) => void | Promise<void>;
  onCancel?: () => void;
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
    <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
      <Grid container spacing={2} mt={3} mb={3}>
        {children}
      </Grid>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2, ...buttonContainerSx }}>
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
