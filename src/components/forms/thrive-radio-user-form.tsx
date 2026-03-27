'use client';

import React, { useState } from 'react';
import {
  Autocomplete,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  IconButton,
  InputAdornment,
  Alert,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { toast } from 'sonner';
import BaseForm from './base-form';
import {
  useAddThriveRadioUser,
  useThriveRadioUserCandidates,
  ThriveRadioCandidate,
} from '@/lib/hooks/use-thrive-radio-users';

interface ThriveRadioUserFormProps {
  onSuccess?: () => void;
  mode?: 'create' | 'edit';
}

export default function ThriveRadioUserForm({
  onSuccess,
}: ThriveRadioUserFormProps) {
  const [selected, setSelected] = useState<ThriveRadioCandidate | null>(null);
  const [credentialsDialog, setCredentialsDialog] = useState<{
    open: boolean;
    email: string;
    password: string | undefined;
    existingCredentials: boolean | undefined;
  }>({ open: false, email: '', password: undefined, existingCredentials: undefined });

  const { data: candidates = [], isLoading: candidatesLoading } =
    useThriveRadioUserCandidates();
  const addUser = useAddThriveRadioUser();

  const handleSubmit = async () => {
    if (!selected) {
      toast.error('Please select a person to add');
      return;
    }

    try {
      const result = await addUser.mutateAsync({
        person_id: selected.id,
        person_type: selected.type,
      });

      setCredentialsDialog({
        open: true,
        email: selected.email,
        password: result.generatedPassword,
        existingCredentials: result.existingCredentials,
      });

      setSelected(null);
    } catch {
      // Error handled by mutation onError
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleCredentialsClose = () => {
    setCredentialsDialog({ open: false, email: '', password: undefined, existingCredentials: undefined });
    if (onSuccess) onSuccess();
  };

  return (
    <>
      <BaseForm<{ person: ThriveRadioCandidate | null }>
        onSubmit={handleSubmit}
        onCancel={onSuccess}
        submitHandler={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        isSubmitting={addUser.isPending}
        submitText="Add User"
      >
        <Autocomplete
          fullWidth
          options={candidates}
          loading={candidatesLoading}
          value={selected}
          onChange={(_e, value) => setSelected(value)}
          getOptionLabel={(option) => option.name}
          groupBy={(option) =>
            option.type === 'employee' ? 'Employees' : 'Members'
          }
          renderInput={(params) => (
            <TextField
              {...(params as any)}
              label="Select Person"
              placeholder="Search by name..."
              required
            />
          )}
          isOptionEqualToValue={(option, value) =>
            option.id === value.id && option.type === value.type
          }
          noOptionsText="No eligible leads or employees found"
        />
      </BaseForm>

      <Dialog
        open={credentialsDialog.open}
        onClose={handleCredentialsClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            bgcolor: 'primary.main',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="h6" fontWeight="bold">
            User Added Successfully
          </Typography>
          <IconButton
            onClick={handleCredentialsClose}
            size="small"
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {credentialsDialog.existingCredentials ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              This employee already has a Program Tracker account. They can log
              in to Thrive Radio with their existing credentials.
            </Alert>
          ) : (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Save these credentials now — the password will not be shown again.
            </Alert>
          )}

          <TextField
            label="Email (User ID)"
            value={credentialsDialog.email}
            fullWidth
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => handleCopy(credentialsDialog.email)}
                    size="small"
                  >
                    <CopyIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />

          {credentialsDialog.password && (
            <TextField
              label="Temporary Password"
              value={credentialsDialog.password}
              fullWidth
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() =>
                        handleCopy(credentialsDialog.password || '')
                      }
                      size="small"
                    >
                      <CopyIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="contained"
            onClick={handleCredentialsClose}
            sx={{ borderRadius: 0, fontWeight: 600 }}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
