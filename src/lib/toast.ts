import { useSyncExternalStore } from 'react';

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: 'good' | 'info' | 'accent' | 'bad';
  icon?: string;
  /** A button in the notice. */
  action?: { label: string; run: () => void };
  /** Shows a close button. */
  closable?: boolean;
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Shows a notice for `ms` (0: until it is closed). */
export function toast(t: Omit<Toast, 'id' | 'tone'> & { tone?: Toast['tone'] }, ms = 3800) {
  const item: Toast = { tone: 'info', ...t, id: nextId++ };
  toasts = [...toasts, item].slice(-4);
  emit();
  if (ms > 0) setTimeout(() => dismiss(item.id), ms);
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => toasts,
  );
}
