/**
 * Root page - redirect is handled by middleware for performance.
 * This page should never actually render because middleware redirects first.
 * 
 * If you see this page, check that middleware is working correctly.
 */
export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p>Redirecting...</p>
    </div>
  );
}