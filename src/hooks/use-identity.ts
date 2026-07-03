import { useEffect, useReducer } from 'react';

import { identity, initIdentity, subscribeIdentity } from '@/lib/auth';

/** Reactive view of the identity state (guest/auth/welcome-seen). */
export function useIdentity() {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    initIdentity();
    return subscribeIdentity(force);
  }, []);
  return identity();
}
