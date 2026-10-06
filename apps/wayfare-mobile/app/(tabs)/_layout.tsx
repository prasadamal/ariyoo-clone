import { Tabs } from 'expo-router';
import { useInbox } from '../../src/context/InboxContext';
import { useAppTheme } from '../../src/theme';
import { Icon } from '../../src/ui/Icon';

export default function TabsLayout() {
  const { colors } = useAppTheme();
  const { unreadMessages, unreadNotifications } = useInbox();
  const inboxBadge = unreadMessages + unreadNotifications;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.onSurface,
        headerTitleStyle: { fontWeight: '800' },
        headerShadowVisible: false,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Journeys',
          headerTitle: 'Wayfare',
          tabBarIcon: ({ color, size }) => <Icon name="book-open-page-variant" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, size }) => <Icon name="compass-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="connect"
        options={{
          title: 'Connect',
          tabBarIcon: ({ color, size }) => <Icon name="account-group-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarBadge: inboxBadge > 0 ? (inboxBadge > 99 ? '99+' : inboxBadge) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.onPrimary },
          tabBarIcon: ({ color, size }) => <Icon name="message-text-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          tabBarIcon: ({ color, size }) => <Icon name="account-circle-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
