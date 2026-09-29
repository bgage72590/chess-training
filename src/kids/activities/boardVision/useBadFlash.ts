// A wrong tap glows softly on the square that was tapped, so a small kid can see which one it was.
import { useEffect, useRef, useState } from 'react';
import type { Sq, SquareTone } from '../types';

export function useBadFlash(ms = 700): [Partial<Record<Sq, SquareTone>>, (sq: Sq) => void] {
  const [sq, setSq] = useState<Sq | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const flash = (s: Sq) => {
    clearTimeout(timer.current);
    setSq(s);
    timer.current = setTimeout(() => setSq(null), ms);
  };
  return [sq ? { [sq]: 'bad' } : {}, flash];
}
