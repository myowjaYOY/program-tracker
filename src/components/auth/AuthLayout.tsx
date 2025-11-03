'use client';

import { useState, useEffect } from 'react';
import { Box, Container } from '@mui/material';
import { Logo } from '@/components/ui/Logo';

interface AuthLayoutProps {
  children: React.ReactNode;
}

// Array of login images from public/logonPics folder
const LOGIN_IMAGES = [
  '/logonPics/Aldana.png',
  '/logonPics/Camilla.png',
  '/logonPics/Emma.png',
  '/logonPics/james%20astronut.jpg',
  '/logonPics/James%20Bigfoot.jpg',
  '/logonPics/James%20Dracul.jpg',
  '/logonPics/Kami.png',
  '/logonPics/Tara.png',
];

// Function to get a random image
const getRandomImage = (): string => {
  const randomIndex = Math.floor(Math.random() * LOGIN_IMAGES.length);
  return LOGIN_IMAGES[randomIndex] || '/logonPics/Aldana.png'; // Fallback to default
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  // Start with a default image to avoid hydration mismatch, then switch to random on client
  const [randomImage, setRandomImage] = useState<string>('/logonPics/Aldana.png');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Only run on client side to avoid SSR/client mismatch
    setIsClient(true);
    setRandomImage(getRandomImage());
  }, []);

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

      {/* Right side - Random Image */}
      <Box
        sx={{
          flex: { xs: '0 0 100%', md: '0 0 58.333333%' },
          display: { xs: 'none', md: 'block' },
          position: 'relative',
          overflow: 'hidden',
          backgroundImage: randomImage ? `url(${randomImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
    </Box>
  );
}
