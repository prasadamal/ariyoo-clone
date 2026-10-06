import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Button, Dialog, Portal, RadioButton, Text, TextInput } from 'react-native-paper';
import { useToast } from '../context/ToastContext';
import { REPORT_REASONS, report } from '../social/moderation';
import type { ReportReason, ReportTarget } from '../social/types';
import { useAppTheme } from '../theme';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  targetType: ReportTarget;
  targetId: string;
  /** Offer "Block this traveller" after reporting. */
  onBlock?: () => void;
};

export function ReportDialog({ visible, onDismiss, targetType, targetId, onBlock }: Props) {
  const { colors } = useAppTheme();
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason>('spam');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const outcome = await report(targetType, targetId, reason, details);
      toast(outcome === 'already' ? 'You already reported this — thank you.' : 'Thanks — our team will review it. Repeatedly reported content is hidden automatically.');
      setDetails('');
      onDismiss();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send report');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={{ maxHeight: '85%' }}>
        <Dialog.Title>Report</Dialog.Title>
        <Dialog.ScrollArea style={{ paddingHorizontal: 0 }}>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 12 }}>
            <Text style={{ color: colors.muted, marginHorizontal: 12, marginBottom: 4 }}>What is wrong with it?</Text>
            <RadioButton.Group value={reason} onValueChange={v => setReason(v as ReportReason)}>
              {REPORT_REASONS.map(r => (
                <RadioButton.Item key={r.value} value={r.value} label={r.label} style={{ paddingVertical: 2 }} />
              ))}
            </RadioButton.Group>
            <TextInput
              mode="outlined"
              label="Details (optional)"
              value={details}
              onChangeText={setDetails}
              multiline
              maxLength={1000}
              style={{ marginHorizontal: 12, marginBottom: 12 }}
            />
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          {onBlock ? (
            <Button
              textColor={colors.error}
              onPress={() => {
                onDismiss();
                onBlock();
              }}
            >
              Block
            </Button>
          ) : null}
          <Button onPress={onDismiss}>Cancel</Button>
          <Button mode="contained" onPress={submit} loading={busy} disabled={busy}>
            Report
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
