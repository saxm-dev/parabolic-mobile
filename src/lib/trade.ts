/** Order placement + market metadata (leverage caps). */
import { API_URL } from '@/lib/api';
import { authToken, currentUserId } from '@/lib/auth';

export interface MarketInfo {
  maxLeverageBySide?: { home: number; away: number };
  maxLeverage?: number;
}

export async function fetchMarket(gameId: string): Promise<MarketInfo> {
  const res = await fetch(`${API_URL}/market/${gameId}`);
  if (!res.ok) return {};
  return (await res.json()) as MarketInfo;
}

export interface OrderResult {
  status?: string;
  avgPx?: number;
  filledSize?: number;
  [k: string]: unknown;
}

const FRIENDLY: Record<string, string> = {
  leverageRejected: 'That leverage is above this market’s cap right now.',
  marketClosed: 'This market isn’t open for trading yet.',
};

/**
 * Market order sized by dollar budget: the backend fits contracts so
 * margin + taker fee ≤ budget at the actual fill price.
 */
export async function placeWager(opts: {
  gameId: string;
  side: 'home' | 'away';
  budget: number;
  sizeEstimate: number;
  leverage: number;
  tp?: number | null;
  sl?: number | null;
}): Promise<OrderResult> {
  const res = await fetch(`${API_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: currentUserId(),
      token: authToken() ?? undefined,
      gameId: opts.gameId,
      side: opts.side,
      type: 'market',
      size: Math.max(1, Math.min(100_000, Math.round(opts.sizeEstimate))),
      budget: opts.budget,
      leverage: opts.leverage,
      tp: opts.tp ?? undefined,
      sl: opts.sl ?? undefined,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as OrderResult & {
    error?: string;
    reason?: string;
  };
  if (!res.ok) {
    const key = data.reason || data.error || '';
    throw new Error(FRIENDLY[key] || data.error || 'Order failed');
  }
  return data;
}

/** Reduce-only market order that closes the full position ("cash out"). */
export async function cashOut(gameId: string, side: 'home' | 'away', size: number): Promise<OrderResult> {
  const res = await fetch(`${API_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: currentUserId(),
      token: authToken() ?? undefined,
      gameId,
      // Closing sells the position: opposite side, reduce-only.
      side: side === 'home' ? 'away' : 'home',
      type: 'market',
      size,
      reduceOnly: true,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as OrderResult & { error?: string };
  if (!res.ok) throw new Error(data.error || 'Cash out failed');
  return data;
}
