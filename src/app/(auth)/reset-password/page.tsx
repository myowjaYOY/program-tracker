import { Metadata } from 'next';
import { Suspense } from 'react';
import AuthLayout from '@/components/auth/AuthLayout';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Reset Password - Program Tracker',
  description: 'Reset your Program Tracker password',
};

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<div>Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}
