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
  InputAdornment,
  IconButton,
  CircularProgress,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    console.log('Form submitted with data:', data);
    setIsLoading(true);
    try {
      const { error } = await signIn(data.email, data.password);
      if (error) {
        console.error('Sign in error:', error);
        toast.error(error.message);
      } else {
        console.log('Sign in successful');
        toast.success('Successfully signed in!');
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = handleSubmit(onSubmit);

  return (
    <Box
      component="form"
      method="POST"
      onSubmit={handleFormSubmit}
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
          Welcome back to Program Tracker 👋
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
          Sign in to your account to continue
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
            // Use theme default borderRadius
          },
        }}
      />

      <Box sx={{ position: 'relative' }}>
        <TextField
          {...register('password')}
          label="Password"
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
          sx={{
            '& .MuiOutlinedInput-root': {
              // Use theme default borderRadius
            },
          }}
        />
        <Box sx={{ textAlign: 'right', mt: 1 }}>
          <Link
            href="/forgot-password"
            variant="body2"
            sx={{
              color: 'primary.main',
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
              },
            }}
          >
            Forgot Password?
          </Link>
        </Box>
      </Box>

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
          'Sign In →'
        )}
      </Button>
    </Box>
  );
}
