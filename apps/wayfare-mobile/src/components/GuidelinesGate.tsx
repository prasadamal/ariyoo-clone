import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useAuth, useCanConnect } from '../context/AuthContext';
import { EmptyState } from '../ui/EmptyState';
import { SignInPrompt } from './SignInPrompt';

/** Community screens require an account and accepted community guidelines (App Store 1.2). */
export function GuidelinesGate({ children, what }: { children: ReactNode; what?: string }) {
  const canConnect = useCanConnect();
  const { profile } = useAuth();
  if (!canConnect) return <SignInPrompt what={what} />;
  if (profile && !profile.guidelines_accepted_at) {
    return (
      <EmptyState
        icon="shield-check-outline"
        title="One quick thing before you connect"
        body="Wayfare is a community of real travellers. Please review and accept the community guidelines — it takes 30 seconds."
        action="Review guidelines"
        onAction={() => router.push('/guidelines')}
      />
    );
  }
  return <>{children}</>;
}
