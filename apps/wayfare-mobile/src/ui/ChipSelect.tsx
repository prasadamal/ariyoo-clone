import { ScrollView, View } from 'react-native';
import { Chip } from 'react-native-paper';
import { useAppTheme } from '../theme';
import { Icon } from './Icon';

export type ChipOption<T extends string> = { value: T; label: string; icon?: string };

type Single<T extends string> = { multi?: false; value: T | null; onChange: (v: T) => void; allowDeselect?: boolean };
type Multi<T extends string> = { multi: true; value: T[]; onChange: (v: T[]) => void };

type Props<T extends string> = { options: ChipOption<T>[]; scroll?: boolean } & (Single<T> | Multi<T>);

export function ChipSelect<T extends string>(props: Props<T>) {
  const { colors } = useAppTheme();
  const isSelected = (v: T) => (props.multi ? props.value.includes(v) : props.value === v);
  const toggle = (v: T) => {
    if (props.multi) {
      props.onChange(props.value.includes(v) ? props.value.filter(x => x !== v) : [...props.value, v]);
    } else if (props.value === v && props.allowDeselect) {
      props.onChange('' as T);
    } else {
      props.onChange(v);
    }
  };
  const chips = props.options.map(o => (
    <Chip
      key={o.value}
      icon={o.icon ? ({ size }) => <Icon name={o.icon!} size={size} color={isSelected(o.value) ? colors.onPrimary : colors.primary} /> : undefined}
      selected={isSelected(o.value)}
      showSelectedCheck={false}
      onPress={() => toggle(o.value)}
      compact
      // Chosen: solid brand colour. Not chosen: quiet grey. The difference reads at a glance.
      style={{ backgroundColor: isSelected(o.value) ? colors.primary : colors.surfaceVariant }}
      textStyle={{ color: isSelected(o.value) ? colors.onPrimary : colors.onSurfaceVariant, fontWeight: isSelected(o.value) ? '700' : '500' }}
      selectedColor={isSelected(o.value) ? colors.onPrimary : colors.onSurfaceVariant}
    >
      {o.label}
    </Chip>
  ));
  if (props.scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
        {chips}
      </ScrollView>
    );
  }
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{chips}</View>;
}
