import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppTheme } from '../theme';
import { Icon } from './Icon';

/**
 * Empty state for a feed: sample post shapes, blurred, with a big "+" in the middle and a short message.
 * The shapes are decoration only (hidden from screen readers); the "+" is the real action.
 */
export function BlurredEmpty({ message, hint, onAdd, addLabel }: { message: string; hint?: string; onAdd: () => void; addLabel: string }) {
  const { colors, dark } = useAppTheme();
  const card = (i: number) => (
    <View key={i} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.head}>
        <View style={[styles.avatar, { backgroundColor: colors.primaryContainer }]} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={[styles.line, { width: '45%', backgroundColor: colors.surfaceVariant }]} />
          <View style={[styles.line, { width: '28%', backgroundColor: colors.surfaceVariant }]} />
        </View>
      </View>
      <View style={[styles.photo, { backgroundColor: i % 2 ? colors.secondaryContainer : colors.primaryContainer }]} />
      <View style={[styles.line, { width: '90%', backgroundColor: colors.surfaceVariant }]} />
      <View style={[styles.line, { width: '60%', backgroundColor: colors.surfaceVariant }]} />
    </View>
  );
  return (
    <View style={styles.wrap}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
        {[0, 1, 2].map(card)}
      </View>
      <BlurView intensity={45} tint={dark ? 'dark' : 'light'} experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.center} pointerEvents="box-none">
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          style={({ pressed }) => [styles.plus, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <Icon name="plus" size={36} color={colors.onPrimary} />
        </Pressable>
        <Text variant="titleMedium" style={{ fontWeight: '800', marginTop: 14 }}>
          {message}
        </Text>
        {hint ? <Text style={{ color: colors.muted, marginTop: 4, textAlign: 'center' }}>{hint}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: 440, borderRadius: 20, overflow: 'hidden', marginTop: 8 },
  card: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 12, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  line: { height: 10, borderRadius: 5 },
  photo: { height: 120, borderRadius: 12 },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  plus: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
});
