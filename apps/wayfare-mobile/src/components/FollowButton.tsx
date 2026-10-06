import { useState } from 'react';
import { Button } from 'react-native-paper';
import { useToast } from '../context/ToastContext';
import { follow, unfollow } from '../social/profiles';

type Props = { userId: string; following: boolean; onChange?: (following: boolean) => void; compact?: boolean };

/** Optimistic follow toggle. */
export function FollowButton({ userId, following, onChange, compact = true }: Props) {
  const toast = useToast();
  const [state, setState] = useState(following);
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    const next = !state;
    setState(next);
    setBusy(true);
    try {
      if (next) await follow(userId);
      else await unfollow(userId);
      onChange?.(next);
    } catch (e) {
      setState(!next);
      toast(e instanceof Error ? e.message : 'Could not update follow');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button
      mode={state ? 'outlined' : 'contained'}
      compact={compact}
      onPress={toggle}
      disabled={busy}
      icon={state ? 'check' : 'account-plus-outline'}
      accessibilityLabel={state ? 'Unfollow' : 'Follow'}
    >
      {state ? 'Following' : 'Follow'}
    </Button>
  );
}
