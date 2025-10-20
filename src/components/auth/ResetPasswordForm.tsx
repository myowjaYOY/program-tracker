'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
  CircularProgress,
  Alert,
  Link,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

const resetPasswordSchema = z
  .object({
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z
      .string()
      .min(6, 'Password must be at least 6 characters'),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  useEffect(() => {
    // Check if this is a password recovery or email confirmation
    const type = searchParams.get('type');
    const code = searchParams.get('code');

    if (type === 'signup') {
      toast.success('Email confirmed successfully! You can now sign in.');
      router.push('/login');
      return;
    }

    // For password recovery, check if we have the required parameters
    if (type === 'recovery' || code) {
      setIsValidToken(true);
      setIsCheckingToken(false);
    } else {
      // No valid token found
      toast.error('Invalid or missing reset token. Please request a new password reset link.');
      setTimeout(() => router.push('/forgot-password'), 2000);
    }
  }, [searchParams, router]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      
      // Update the user's password
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        console.error('Password reset error:', error);
        toast.error(error.message || 'Failed to reset password. Please try again.');
        return;
      }

      toast.success('Password reset successfully! Redirecting to login...');
      
      // Sign out to ensure clean state
      await supabase.auth.signOut();
      
      // Redirect to login after a brief delay
      setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while checking token
  if (isCheckingToken) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          width: '100%',
          maxWidth: 400,
          mx: 'auto',
          textAlign: 'center',
        }}
      >
        <CircularProgress size={40} />
        <Typography variant="body1" color="text.secondary">
          Verifying reset link...
        </Typography>
      </Box>
    );
  }

  // Show error if token is invalid
  if (!isValidToken) {
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
        <Alert severity="error" sx={{ mb: 2 }}>
          Invalid or expired reset link
        </Alert>
        <Typography variant="h4" component="h1" gutterBottom>
          Reset Link Invalid ❌
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          This password reset link is invalid or has expired. Please request a new one.
        </Typography>
        <Button
          variant="contained"
          fullWidth
          size="large"
          onClick={() => router.push('/forgot-password')}
          sx={{
            mt: 2,
            py: 1.5,
            fontSize: '1rem',
            fontWeight: 600,
          }}
        >
          Request New Reset Link
        </Button>
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
          Reset Your Password 🔑
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
          Enter your new password below
        </Typography>
      </Box>

      <TextField
        {...register('password')}
        label="New Password"
        type={showPassword ? 'text' : 'password'}
        fullWidth
        error={!!errors.password}
        helperText={errors.password?.message}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={() => setShowPassword(!showPassword)}
                edge="end"
                sx={{ color: 'text.secondary' }}
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      <TextField
        {...register('confirmPassword')}
        label="Confirm New Password"
        type={showConfirmPassword ? 'text' : 'password'}
        fullWidth
        error={!!errors.confirmPassword}
        helperText={errors.confirmPassword?.message}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                edge="end"
                sx={{ color: 'text.secondary' }}
              >
                {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
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
          fontSize: '1rem',
          fontWeight: 600,
        }}
      >
        {isLoading ? (
          <CircularProgress size={24} color="inherit" />
        ) : (
          'Reset Password'
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
