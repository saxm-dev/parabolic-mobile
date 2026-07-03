import { useCallback, useEffect, useRef, useState } from 'react';

import { useIdentity } from '@/hooks/use-identity';
import { currentUserId } from '@/lib/auth';
import { fetchBalance, fetchPositions, type BalanceInfo, type Position } from '@/lib/api';

/** Polls the trading account (balance + open positions) for the current identity. */
export function useAccount(pollMs = 15_000) {
  const id = useIdentity();
  const userId = id.ready ? currentUserId() : null;
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const [b, p] = await Promise.all([fetchBalance(userId), fetchPositions(userId)]);
      if (mounted.current) {
        setBalance(b);
        setPositions(p);
      }
    } catch {
      // Keep last known values; home poll will retry.
    }
  }, [userId]);

  useEffect(() => {
    mounted.current = true;
    setBalance(null);
    setPositions([]);
    refresh();
    const t = setInterval(refresh, pollMs);
    return () => {
      mounted.current = false;
      clearInterval(t);
    };
  }, [refresh, pollMs]);

  return { balance, positions, refresh, userId };
}
