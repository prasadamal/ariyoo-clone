import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Snackbar } from 'react-native-paper';

type Toast = { message: string; action?: { label: string; onPress: () => void } };
type Ctx = { toast: (message: string, action?: Toast['action']) => void };

const ToastContext = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<Toast | null>(null);
  const toast = useCallback((message: string, action?: Toast['action']) => setCurrent({ message, action }), []);
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        visible={!!current}
        onDismiss={() => setCurrent(null)}
        duration={3500}
        action={current?.action ? { label: current.action.label, onPress: current.action.onPress } : undefined}
        style={{ marginBottom: 72 }}
      >
        {current?.message ?? ''}
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast outside ToastProvider');
  return ctx.toast;
}

/** Runs an async action and toasts its error message, returning undefined on failure. */
export function useSafeAction() {
  const toast = useToast();
  return useCallback(
    async <T,>(fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
      try {
        const out = await fn();
        if (success) toast(success);
        return out;
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Something went wrong');
        return undefined;
      }
    },
    [toast]
  );
}
