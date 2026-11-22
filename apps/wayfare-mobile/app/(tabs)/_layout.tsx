import { Tabs } from 'expo-router';
import { useInbox } from '../../src/context/InboxContext';
import { useAppTheme } from '../../src/theme';
import { Icon } from '../../src/ui/Icon';
import { SOCIAL_ENABLED } from '../../src/lib/features';

// While social features are off the bar is Journeys · Journal · You; the social tabs stay in the code
// (href: null hides a tab without removing its screen) and come back with the switch.
const socialTab = SOCIAL_ENABLED ? {} : { href: null };

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
        name="journal"
        options={{
          title: 'Journal',
          tabBarIcon: ({ color, size }) => <Icon name="notebook-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          ...socialTab,
          title: 'Discover',
          tabBarIcon: ({ color, size }) => <Icon name="compass-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="connect"
        options={{
          ...socialTab,
          title: 'Connect',
          tabBarIcon: ({ color, size }) => <Icon name="account-group-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          ...socialTab,
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
          headerShown: false, // the profile draws its own header
          tabBarIcon: ({ color, size }) => <Icon name="account-circle-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
