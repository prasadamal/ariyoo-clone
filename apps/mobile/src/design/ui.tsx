import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text as RNText, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, space, type, useTokens } from './tokens';

/** Large page heading with an optional one-line explanation: where am I, and what is this for. */
export function PageHeader({ title, subtitle, eyebrow }: { title: string; subtitle?: string; eyebrow?: string }) {
  const { c } = useTokens();
  return (
    <View style={{ marginBottom: space.xl }}>
      {eyebrow ? <RNText style={[type.caption, { color: c.accent, marginBottom: space.sm, textTransform: 'uppercase' }]}>{eyebrow}</RNText> : null}
      <RNText accessibilityRole="header" style={[type.title, { color: c.text }]}>{title}</RNText>
      {subtitle ? <RNText style={[type.body, { color: c.textMuted, marginTop: space.xs }]}>{subtitle}</RNText> : null}
    </View>
  );
}

/** A grouped surface. Tappable cards get a press state instead of a ripple-less flash. */
export function Card({ children, style, onPress, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string }) {
  const { c } = useTokens();
  const base = [styles.card, { backgroundColor: c.surface, borderColor: c.border }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, pressed && { backgroundColor: c.surfaceAlt, transform: [{ scale: 0.99 }] }]}>
      {children}
    </Pressable>
  );
}

/** Small uppercase label above a group of rows. */
export function SectionLabel({ children }: { children: string }) {
  const { c } = useTokens();
  return <RNText style={[type.caption, { color: c.textFaint, textTransform: 'uppercase', marginBottom: space.sm, marginTop: space.lg }]}>{children}</RNText>;
}

/** Round avatar with initials; the colour is stable per name so people are recognisable. */
export function Avatar({ name, size = 44 }: { name?: string | null; size?: number }) {
  const { c, dark } = useTokens();
  const initials = (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';
  const hues = dark ? ['#1F6E57', '#6B4E1A', '#3B4A7A', '#6E2E3C', '#2F5E6E'] : ['#CFEBDD', '#F7DFB5', '#D9DDF5', '#F5D3D9', '#CDE7EE'];
  const ink = dark ? '#F2FBF7' : c.text;
  let hash = 0;
  for (const ch of name || '') hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no" style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: hues[hash % hues.length], alignItems: 'center', justifyContent: 'center' }}>
      <RNText style={{ color: ink, fontWeight: '700', fontSize: size * 0.38 }}>{initials}</RNText>
    </View>
  );
}

type Tone = 'accent' | 'expert' | 'neutral' | 'danger';
/** A compact status label, for example "Waiting", "Answered" or "Local expert". */
export function Pill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const { c } = useTokens();
  const colors = {
    accent: [c.accentSoft, c.onAccentSoft],
    expert: [c.expertSoft, c.onExpertSoft],
    danger: [c.dangerSoft, c.danger],
    neutral: [c.surfaceAlt, c.textMuted],
  }[tone];
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: colors[0], borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
      <RNText style={{ color: colors[1], fontSize: 12, fontWeight: '700' }}>{label}</RNText>
    </View>
  );
}

/** Friendly empty state: what is missing and the one thing to do about it. */
export function EmptyState({ icon, title, body, action }: { icon: string; title: string; body: string; action?: ReactNode }) {
  const { c } = useTokens();
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxxl, paddingHorizontal: space.xl }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg }}>
        <RNText style={{ fontSize: 28 }} accessibilityElementsHidden importantForAccessibility="no">{icon}</RNText>
      </View>
      <RNText style={[type.heading, { color: c.text, textAlign: 'center' }]}>{title}</RNText>
      <RNText style={[type.small, { color: c.textMuted, textAlign: 'center', marginTop: space.xs, maxWidth: 300 }]}>{body}</RNText>
      {action ? <View style={{ marginTop: space.lg }}>{action}</View> : null}
    </View>
  );
}

/** Inline notice for errors and confirmations, announced by screen readers. */
export function Notice({ text, tone = 'danger' }: { text: string; tone?: 'danger' | 'success' }) {
  const { c } = useTokens();
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ backgroundColor: tone === 'danger' ? c.dangerSoft : c.accentSoft, borderRadius: radius.sm, padding: space.md, marginBottom: space.md }}>
      <RNText style={[type.small, { color: tone === 'danger' ? c.danger : c.onAccentSoft, fontWeight: '600' }]}>{text}</RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg },
});
