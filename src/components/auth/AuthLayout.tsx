'use client';

import { Box, Container } from '@mui/material';
import { Logo } from '@/components/ui/Logo';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex' }}>
      {/* Left side - Form */}
      <Box
        sx={{
          flex: { xs: '1 1 100%', md: '0 0 41.666667%' },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'background.default',
          p: 3,
        }}
      >
        <Container maxWidth="sm">{children}</Container>
      </Box>

      {/* Right side - Image */}
      <Box
        sx={{
          flex: { xs: '0 0 100%', md: '0 0 58.333333%' },
          display: { xs: 'none', md: 'block' },
          position: 'relative',
          overflow: 'hidden',
          backgroundImage: 'url(/James%20Geek.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
    </Box>
  );
}
