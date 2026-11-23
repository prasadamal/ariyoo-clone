import { useState } from 'react';
import { View } from 'react-native';
import type { LocalTrip } from '../../lib/localDb';
import { FloatingTabs } from '../../ui/FloatingTabs';
import { PackingTab } from './PackingTab';
import { PlanTab } from './PlanTab';

type View_ = 'plan' | 'pack';

/** Plan and Pack in one place: the day-by-day plan, and what to take, behind a small toggle. */
export function PlanPackTab({ trip, onChanged, readOnly = false }: { trip: LocalTrip; onChanged: () => void; readOnly?: boolean }) {
  const [view, setView] = useState<View_>('plan');
  return (
    <View>
      <FloatingTabs<View_>
        accessibilityLabel="Plan or pack"
        tabs={[
          { value: 'plan', label: 'Day plan' },
          { value: 'pack', label: 'Packing' },
        ]}
        value={view}
        onChange={setView}
        style={{ alignSelf: 'center', marginBottom: 16 }}
      />
      {view === 'plan' ? <PlanTab trip={trip} onChanged={onChanged} readOnly={readOnly} /> : <PackingTab trip={trip} onChanged={onChanged} />}
    </View>
  );
}
