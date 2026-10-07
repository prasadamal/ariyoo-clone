import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { setAppBadge } from '../lib/notifications';
import { myConversations, subscribeToInbox } from '../social/chat';
import { unreadNotificationCount } from '../social/notifications';
import type { ConversationSummary } from '../social/types';
import { useAuth, useCanConnect } from './AuthContext';

type Ctx = {
  conversations: ConversationSummary[];
  unreadMessages: number;
  unreadNotifications: number;
  loading: boolean;
  refresh: () => Promise<void>;
  /** The chat currently on screen (its messages do not count as unread). */
  setActiveConversation: (id: string | null) => void;
};

const InboxContext = createContext<Ctx | null>(null);

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const canConnect = useCanConnect();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(false);
  const active = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!canConnect) {
      setConversations([]);
      setUnreadNotifications(0);
      return;
    }
    setLoading(true);
    try {
      const [convs, unread] = await Promise.all([myConversations(), unreadNotificationCount()]);
      setConversations(convs);
      setUnreadNotifications(unread);
    } catch {
      // offline: keep last state
    } finally {
      setLoading(false);
    }
  }, [canConnect]);

  const scheduleRefresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(refresh, 700);
  }, [refresh]);

  useEffect(() => {
    refresh();
    if (!canConnect || !user?.id) return;
    const unsubscribe = subscribeToInbox(user.id, scheduleRefresh);
    const sub = AppState.addEventListener('change', s => s === 'active' && refresh());
    return () => {
      unsubscribe();
      sub.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [canConnect, user?.id, refresh, scheduleRefresh]);

  const unreadMessages = useMemo(
    () =>
      conversations
        .filter(c => !c.muted && c.id !== active.current && c.kind !== 'place')
        .reduce((sum, c) => sum + c.unread_count, 0),
    [conversations]
  );

  useEffect(() => {
    setAppBadge(unreadMessages + unreadNotifications);
  }, [unreadMessages, unreadNotifications]);

  const value = useMemo(
    () => ({
      conversations,
      unreadMessages,
      unreadNotifications,
      loading,
      refresh,
      setActiveConversation: (id: string | null) => {
        active.current = id;
      },
    }),
    [conversations, unreadMessages, unreadNotifications, loading, refresh]
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useInbox() {
  const ctx = useContext(InboxContext);
  if (!ctx) throw new Error('useInbox outside InboxProvider');
  return ctx;
}
