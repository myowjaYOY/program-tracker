import { Box, Container } from '@mui/material';
import { headers } from 'next/headers';
import { getAdminSupabase } from '@/lib/auth/admin';
import { Alert, Typography } from '@mui/material';

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
 * Fetch tenant based on hostname (uses admin client to bypass RLS)
 */
async function getTenantByHost(host: string) {
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'localhost';
  const hostWithoutPort = host.split(':')[0] ?? '';

  if (!hostWithoutPort.endsWith(baseDomain)) return null;

  const subdomain = hostWithoutPort.replace(`.${baseDomain}`, '');
  if (!subdomain || subdomain === 'www' || subdomain === hostWithoutPort) return null;

  const supabase = getAdminSupabase();
  const { data } = await supabase
    .from('tenants')
    .select('tenant_name, tenant_slug, is_active, settings')
    .eq('tenant_slug', subdomain)
    .single();

  return data;
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
export default async function AuthLayout({ children }: AuthLayoutProps) {
  // Image is selected once per page render on the server
  let bgImage = getRandomImage();

  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = await getTenantByHost(host);

  if (tenant && tenant.settings?.branding?.login_image_url) {
    bgImage = tenant.settings.branding.login_image_url;
  }

  let content = children;

  // If we're on a subdomain, check tenant status
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'localhost';
  const hostWithoutPort = host.split(':')[0] ?? '';
  const hasSubdomain = hostWithoutPort.endsWith(baseDomain) &&
    hostWithoutPort !== baseDomain &&
    hostWithoutPort.replace(`.${baseDomain}`, '') !== 'www';

  if (hasSubdomain && !tenant) {
    // Subdomain doesn't match any tenant
    content = (
      <Box sx={{ p: 4, textAlign: 'center', width: '100%' }}>
        <Alert severity="warning" variant="filled" sx={{ mx: 'auto', mt: 4 }}>
          <Typography variant="h6">Organization Not Found</Typography>
          <Typography>No organization exists at this address. Please check the URL and try again.</Typography>
        </Alert>
      </Box>
    );
  } else if (tenant && !tenant.is_active) {
    content = (
      <Box sx={{ p: 4, textAlign: 'center', width: '100%' }}>
        <Alert severity="error" variant="filled" sx={{ mx: 'auto', mt: 4 }}>
          <Typography variant="h6">Tenant Deactivated</Typography>
          <Typography>This organization&apos;s account has been deactivated. Please contact support.</Typography>
        </Alert>
      </Box>
    );
  }

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
        <Container maxWidth="sm">{content}</Container>
      </Box>

      {/* Right side - Random Image */}
      <Box
        sx={{
          flex: { xs: '0 0 100%', md: '0 0 58.333333%' },
          display: { xs: 'none', md: 'block' },
          position: 'relative',
          overflow: 'hidden',
          backgroundImage: `url('${bgImage}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
    </Box>
  );
}