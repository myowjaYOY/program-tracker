import { Metadata } from 'next';
import AuthLayout from '@/components/auth/AuthLayout';
import LoginForm from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Login - Program Tracker',
  description: 'Sign in to your Program Tracker account',
};

export default function LoginPage() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
