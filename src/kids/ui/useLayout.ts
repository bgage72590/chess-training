// Layout helpers: landscape = width/height above 1.1 and at least 700px wide (spec 7.8).
import { useSyncExternalStore } from 'react';

const query = () => (typeof window === 'undefined' ? false : window.innerWidth >= 700 && window.innerWidth / window.innerHeight > 1.1);

export function useIsLandscape(): boolean {
  return useSyncExternalStore(
    (l) => {
      window.addEventListener('resize', l);
      return () => window.removeEventListener('resize', l);
    },
    query,
    () => false,
  );
}
