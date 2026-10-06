import { ScrollView, View } from 'react-native';
import { Chip } from 'react-native-paper';

export type ChipOption<T extends string> = { value: T; label: string; icon?: string };

type Single<T extends string> = { multi?: false; value: T | null; onChange: (v: T) => void; allowDeselect?: boolean };
type Multi<T extends string> = { multi: true; value: T[]; onChange: (v: T[]) => void };

type Props<T extends string> = { options: ChipOption<T>[]; scroll?: boolean } & (Single<T> | Multi<T>);

export function ChipSelect<T extends string>(props: Props<T>) {
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
    <Chip key={o.value} icon={o.icon} selected={isSelected(o.value)} showSelectedOverlay onPress={() => toggle(o.value)} compact>
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
