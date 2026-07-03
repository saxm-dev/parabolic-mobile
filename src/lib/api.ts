/**
 * Parabolic backend API client.
 * Same Railway backend as the web terminal (app.parabolic.gg).
 */

export const API_URL = 'https://perpdictions-backend-production.up.railway.app/api';
export const WS_URL = 'wss://perpdictions-backend-production.up.railway.app/ws';

export interface TeamSide {
  name: string;
  abbreviation: string;
  logo: string;
  color: string;
  altColor: string;
  score: number;
  record: string;
  id: string;
  winner: boolean;
}

export interface OracleSource {
  name: string;
  price: number;
  weight: number;
  ageMs: number;
  stale: boolean;
  primary: boolean;
  excluded: boolean;
}

export interface OracleState {
  gameId: string;
  /** Home-team win probability, 0..1 */
  indexPrice: number;
  markPrice: number;
  settled: boolean;
  sources: OracleSource[];
  confidence: number;
  liqSafe: boolean;
  updatedAt: number;
  halted: boolean;
}

export interface Game {
  id: string;
  espnId: string;
  league: string;
  leagueDisplay: string;
  sport: string;
  name: string;
  shortName: string;
  status: string;
  statusDetail: string;
  period: number;
  clock: string;
  startTime: string;
  home: TeamSide;
  away: TeamSide;
  venue: string;
  broadcast: string;
  oracle: OracleState | null;
  playCount: number;
  tradeable: boolean;
  pregame: boolean;
}

export interface LeaderboardEntry {
  userId: string;
  username: string | null;
  balance: number;
  closedPnl: number;
  returnPct: number;
  tradeCount: number;
  totalVolume: number;
  openPositions: number;
  points: number;
  streak: number;
  rank: number;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`${API_URL}${path}`, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchGames(): Promise<Game[]> {
  const data = await api<{ games: Game[] }>('/games');
  return data.games ?? [];
}

export async function fetchLeaderboard(sort: 'points' | 'pnl' = 'points'): Promise<LeaderboardEntry[]> {
  const data = await api<{ leaderboard: LeaderboardEntry[] }>(`/leaderboard?sort=${sort}`);
  return data.leaderboard ?? [];
}

export interface Play {
  id: string;
  text: string;
  shortText: string;
  clock: string;
  period: number;
  periodDisplay: string;
  homeScore: number;
  awayScore: number;
  scoringPlay: boolean;
  scoreValue: number;
  teamId: string;
  wallclock: string;
  homeWinPct: number | null;
}

export interface BoxStat {
  name: string;
  displayName: string;
  value: string;
}

export interface BoxTeam {
  team: string;
  stats: BoxStat[];
}

export interface GameDetail extends Game {
  plays: Play[];
  boxscore: { teams?: BoxTeam[]; players?: unknown } | null;
}

export interface HistoryPoint {
  t: number;
  /** index price (oracle fair value), 0..1 home win prob */
  ip: number;
  /** mark price, 0..1 home win prob */
  mp: number;
}

export async function fetchGameDetail(id: string): Promise<GameDetail> {
  return api<GameDetail>(`/games/${id}`);
}

export async function fetchOracleHistory(id: string): Promise<HistoryPoint[]> {
  const data = await api<{ history: HistoryPoint[] }>(`/oracle/${id}/history`);
  return data.history ?? [];
}
