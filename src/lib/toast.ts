import { useSyncExternalStore } from 'react';

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: 'good' | 'info' | 'accent' | 'bad';
  icon?: string;
}

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(t: Omit<Toast, 'id' | 'tone'> & { tone?: Toast['tone'] }, ms = 3800) {
  const item: Toast = { tone: 'info', ...t, id: nextId++ };
  toasts = [...toasts, item].slice(-4);
  emit();
  setTimeout(() => dismiss(item.id), ms);
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
