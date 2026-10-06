import { router } from 'expo-router';
import { EmptyState } from '../ui/EmptyState';
import { useAuth } from '../context/AuthContext';

/** Shown in community areas for guests / builds without cloud. */
export function SignInPrompt({ what = 'connect with travellers' }: { what?: string }) {
  const { offlineMode } = useAuth();
  if (offlineMode) {
    return (
      <EmptyState
        icon="cloud-off-outline"
        title="Community is offline in this build"
        body="Your journal works fully offline. Community features turn on when Wayfare cloud is configured (EXPO_PUBLIC_SUPABASE_URL + key)."
      />
    );
  }
  return (
    <EmptyState
      icon="account-group-outline"
      title={`Create a free account to ${what}`}
      body="Find travellers heading where you are, join crews, chat, share journeys and back up your journal. Your existing trips come with you."
      action="Create account"
      onAction={() => router.push('/register')}
      secondary="I already have an account"
      onSecondary={() => router.push('/login')}
    />
  );
}
