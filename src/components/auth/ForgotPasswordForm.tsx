'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box,
  TextField,
  Button,
  Typography,
  Link,
  CircularProgress,
  Alert,
} from '@mui/material';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast.error(error.message);
      } else {
        setIsSuccess(true);
        toast.success('Password reset email sent! Check your inbox.');
      }
    } catch (error) {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          width: '100%',
          maxWidth: 400,
          mx: 'auto',
          textAlign: 'center',
        }}
      >
        <Alert severity="success" sx={{ mb: 2 }}>
          Check your email for a password reset link!
        </Alert>
        <Typography variant="h4" component="h1" gutterBottom>
          Email Sent! 📧
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          We have sent a password reset link to your email address. Click the
          link in the email to reset your password.
        </Typography>
        <Link
          href="/login"
          variant="body2"
          sx={{
            color: 'primary.main',
            textDecoration: 'none',
            '&:hover': {
              textDecoration: 'underline',
            },
          }}
        >
          ← Back to Login
        </Link>
      </Box>
    );
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        width: '100%',
        maxWidth: 400,
        mx: 'auto',
      }}
    >
      <Box sx={{ textAlign: 'center', mb: 2 }}>
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{
            fontWeight: 700,
            color: 'text.primary',
          }}
        >
          Forgot your password? 🔑
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
          Enter your email address and we will send you a link to reset your
          password.
        </Typography>
      </Box>

      <TextField
        {...register('email')}
        label="Email"
        type="email"
        fullWidth
        error={!!errors.email}
        helperText={errors.email?.message}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
          },
        }}
      />

      <Button
        type="submit"
        variant="contained"
        fullWidth
        size="large"
        disabled={isLoading}
        sx={{
          mt: 2,
          py: 1.5,
          borderRadius: 2,
          textTransform: 'none',
          fontSize: '1rem',
          fontWeight: 600,
          backgroundColor: 'primary.main',
          '&:hover': {
            backgroundColor: 'primary.dark',
          },
        }}
      >
        {isLoading ? (
          <CircularProgress size={24} color="inherit" />
        ) : (
          'Send Reset Link'
        )}
      </Button>

      <Box sx={{ textAlign: 'center', mt: 2 }}>
        <Link
          href="/login"
          variant="body2"
          sx={{
            color: 'primary.main',
            textDecoration: 'none',
            '&:hover': {
              textDecoration: 'underline',
            },
          }}
        >
          ← Back to Login
        </Link>
      </Box>
    </Box>
  );
}
