import * as Haptics from 'expo-haptics';
import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme';
import { Glass, withAlpha } from './Glass';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** Height of the floating bar plus its gap from the bottom edge: tab screens leave this much room. */
export const TAB_BAR_SPACE = 96;

/**
 * The tab bar as a floating glass pill over the content, like iOS 26. Tabs hidden with `href: null`
 * (the switched-off social tabs) are skipped.
 */
export function GlassTabBar({ state, descriptors, navigation }: TabBarProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter(r => {
    const o = descriptors[r.key]?.options as { href?: unknown; tabBarItemStyle?: { display?: string } } | undefined;
    return o?.href !== null && o?.tabBarItemStyle?.display !== 'none';
  });

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom, 10) + 4, alignItems: 'center' }}
    >
      <Glass
        radius={30}
        interactive
        style={{
          flexDirection: 'row',
          padding: 6,
          gap: 4,
          minWidth: 260,
          maxWidth: 420,
          width: '86%',
          // A soft shadow lifts the bar off the page.
          shadowColor: '#000',
          shadowOpacity: 0.16,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: Platform.OS === 'android' ? 10 : 0,
        }}
      >
        {routes.map(route => {
          const options = descriptors[route.key].options;
          const focused = state.routes[state.index]?.key === route.key;
          const color = focused ? colors.primary : colors.onSurfaceVariant;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const badge = options.tabBarBadge;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              Haptics.selectionAsync().catch(() => undefined);
              navigation.navigate(route.name, route.params);
            }
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 7,
                borderRadius: 24,
                backgroundColor: focused ? withAlpha(colors.primary, 0.13) : 'transparent',
                transform: [{ scale: pressed ? 0.94 : 1 }],
              })}
            >
              <View>
                {options.tabBarIcon?.({ focused, color, size: 24 })}
                {badge != null ? (
                  <View style={{ position: 'absolute', top: -4, right: -10, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                    <Text style={{ color: colors.onPrimary, fontSize: 11, fontWeight: '800' }}>{String(badge)}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ color, fontSize: 11, fontWeight: focused ? '800' : '600', marginTop: 2 }}>{label}</Text>
            </Pressable>
          );
        })}
      </Glass>
    </View>
  );
}
