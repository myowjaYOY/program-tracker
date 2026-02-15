import { Box, Container } from '@mui/material';

interface AuthLayoutProps {
  children: React.ReactNode;
}

// Array of login images from public/logonPics folder
const LOGIN_IMAGES = [
  '/logonPics/Camilla.jpg',
  '/logonPics/James%20Bigfoot.jpg',
  '/logonPics/james.jpg',
  '/logonPics/Jen.jpg',
  '/logonPics/kami.jpg',
  '/logonPics/Ken.jpg',
  '/logonPics/Tara.jpg',
];

// Server-side random image selection (no hydration mismatch)
function getRandomImage(): string {
  const randomIndex = Math.floor(Math.random() * LOGIN_IMAGES.length);
  return LOGIN_IMAGES[randomIndex] || '/logonPics/Camilla.jpg';
}

/**
 * AuthLayout - Server Component
 * 
 * Renders the authentication page layout with a random background image.
 * Converted from Client Component to eliminate hydration mismatch and reduce JS bundle.
 * 
 * Benefits:
 * - No useState/useEffect for image selection
 * - Image selected at request time (SSR)
 * - ~1KB JS bundle reduction
 * - No hydration flicker
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  // Image is selected once per page render on the server
  const randomImage = getRandomImage();

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
          backgroundImage: `url(${randomImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
    </Box>
  );
}