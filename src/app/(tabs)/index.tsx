import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { Txt } from '@/components/txt';
import { Brand, Radii } from '@/constants/theme';
import { useAccount } from '@/hooks/use-account';
import { useIdentity } from '@/hooks/use-identity';
import { fetchGames, type Game, type Position } from '@/lib/api';

const POLL_MS = 15_000;
const NAV_SPACE = 108; // floating nav clearance

const SPORT_ORDER = ['wcup', 'mlb', 'nfl', 'nba', 'ncaam', 'nhl', 'mls'];
const SPORT_CHIP: Record<string, { label: string; icon?: IconName }> = {
  nfl: { label: 'Football', icon: 'chipFootball' },
  wcup: { label: 'World Cup', icon: 'chipSoccer' },
  mls: { label: 'Soccer', icon: 'chipSoccer' },
  nba: { label: 'Basketball', icon: 'chipBasketball' },
  ncaam: { label: 'Basketball', icon: 'chipBasketball' },
  mlb: { label: 'Baseball' },
  nhl: { label: 'Hockey' },
};

const isLive = (g: Game) => g.status === 'live' || g.status === 'in';
const isUpcoming = (g: Game) => g.status === 'scheduled' || g.status === 'pre' || g.pregame;

function fmtUsd(n: number, digits = 2): string {
  const s = n < 0 ? '-' : '';
  return `${s}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}
function fmtStart(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Today at ${t}`;
  if (d.toDateString() === new Date(now.getTime() + 864e5).toDateString()) return `Tomorrow at ${t}`;
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · ${t}`;
}
function homeProb(g: Game): number | null {
  const o = g.oracle;
  if (!o) return null;
  const p = o.markPrice > 0 ? o.markPrice : o.indexPrice;
  return p > 0 && p < 1 ? p : null;
}
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

// ── Header ──────────────────────────────────────────────────────────────────
function Header({ value, onAvatar }: { value: number | null; onAvatar: () => void }) {
  return (
    <View style={s.header}>
      <Image
        source={require('../../../assets/figma/logoWordmark.png')}
        style={{ width: 92, height: 16 }}
        contentFit="contain"
      />
      <View style={s.headerRight}>
        <View style={s.balancePill}>
          <View style={s.coin} />
          <Txt variant="balance">{value == null ? '—' : fmtUsd(value)}</Txt>
          <View style={s.plusBtn}>
            <Txt variant="balance" color={Brand.white} style={{ lineHeight: 14 }}>
              +
            </Txt>
          </View>
        </View>
        <Pressable onPress={onAvatar} style={s.avatar} hitSlop={6}>
          <Image source={{ uri: 'https://i.pravatar.cc/64' }} style={s.avatarImg} />
        </Pressable>
      </View>
    </View>
  );
}

// ── Greeting (3-line headline) ────────────────────────────────────────────────
function Greeting({
  name,
  pnl,
  betCount,
  openCount,
  hasBets,
  liveCount,
}: {
  name: string | null;
  pnl: number;
  betCount: number;
  openCount: number;
  hasBets: boolean;
  liveCount: number;
}) {
  return (
    <View style={s.greeting}>
      <Txt variant="display">
        {greeting()}
        {name ? `, ${name}` : ''}
      </Txt>
      {hasBets ? (
        <>
          <View style={s.greetLine}>
            <Txt variant="display" o={0.5}>
              You’re
            </Txt>
            <Txt variant="display" color={pnl >= 0 ? Brand.green : Brand.red}>
              {pnl >= 0 ? '+' : ''}
              {fmtUsd(pnl, 0)}
            </Txt>
            <View style={s.fromPill}>
              <Txt variant="capsLg" color={Brand.offWhite} o={0.9} upper>
                From {betCount} {betCount === 1 ? 'bet' : 'bets'}
              </Txt>
            </View>
          </View>
          <Txt variant="display">
            {openCount} open {openCount === 1 ? 'bet' : 'bets'} still in play
          </Txt>
        </>
      ) : (
        <Txt variant="display" o={0.5}>
          {liveCount > 0
            ? `${liveCount} ${liveCount === 1 ? 'game' : 'games'} live right now`
            : 'Markets open before kickoff'}
        </Txt>
      )}
    </View>
  );
}

// ── Open-bet card ─────────────────────────────────────────────────────────────
function OpenBetCard({ pos, game, onPress }: { pos: Position; game?: Game; onPress: () => void }) {
  const team = game ? (pos.side === 'home' ? game.home : game.away) : null;
  const up = pos.pnl >= 0;
  return (
    <Pressable onPress={onPress} style={s.betCard}>
      <View style={s.betTeam}>
        {team && <Image source={{ uri: team.logo }} style={s.betFlag} contentFit="contain" />}
        <Txt variant="label" numberOfLines={1}>
          {team?.name ?? pos.side.toUpperCase()}
        </Txt>
      </View>
      <View style={{ gap: 4 }}>
        <Txt variant="pnl" color={up ? Brand.green : Brand.red}>
          {up ? '+' : ''}
          {fmtUsd(pos.pnl)}
        </Txt>
        <View style={s.betPctPill}>
          <Txt variant="pctPill" color={Brand.pctPillText}>
            {up ? '+' : ''}
            {pos.roe.toFixed(1)}%
          </Txt>
        </View>
      </View>
    </Pressable>
  );
}

// ── Sport chips ───────────────────────────────────────────────────────────────
function Chip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon?: IconName;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]}>
      {icon && <Icon name={icon} size={16} opacity={active ? 0.8 : 0.4} />}
      <Txt variant="body" o={active ? 1 : 0.5}>
        {label}
      </Txt>
    </Pressable>
  );
}

// ── Game card ────────────────────────────────────────────────────────────────
function SideCol({
  logo,
  score,
  abbr,
  pct,
  pctColor,
  align,
  showScore,
}: {
  logo: string;
  score: number;
  abbr: string;
  pct: number | null;
  pctColor: string;
  align: 'left' | 'right';
  showScore: boolean;
}) {
  const flagScore = (
    <View style={s.flagScore}>
      <Image source={{ uri: logo }} style={s.cardFlag} contentFit="contain" />
      {showScore && <Txt variant="score">{score}</Txt>}
    </View>
  );
  return (
    <View style={[s.sideCol, { alignItems: align === 'left' ? 'flex-start' : 'flex-end' }]}>
      {align === 'left' ? flagScore : <View style={s.flagScoreRev}>{flagScore}</View>}
      <View style={s.sideMeta}>
        {align === 'left' ? (
          <>
            <Txt variant="label">{abbr}</Txt>
            {pct != null && (
              <Txt variant="pct" color={pctColor}>
                {pct}%
              </Txt>
            )}
          </>
        ) : (
          <>
            {pct != null && (
              <Txt variant="pct" color={pctColor}>
                {pct}%
              </Txt>
            )}
            <Txt variant="label">{abbr}</Txt>
          </>
        )}
      </View>
    </View>
  );
}

function GameCard({ game, onPress }: { game: Game; onPress: () => void }) {
  const live = isLive(game);
  const p = homeProb(game);
  const homePct = p == null ? null : Math.round(p * 100);
  const awayPct = homePct == null ? null : 100 - homePct;
  const showScore = live || game.status === 'final';

  return (
    <Pressable
      onPress={onPress}
      style={[s.card, live ? s.cardLive : s.cardIdle]}>
      {live && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(45,190,78,0.07)' }]} pointerEvents="none" />
      )}
      <View style={s.cardHeader}>
        <Txt variant="caps" color={Brand.offWhite} o={0.6} upper>
          {game.leagueDisplay}
        </Txt>
        {live ? (
          <View style={s.livePill}>
            <Txt variant="caps" color={Brand.white} upper>
              Live
            </Txt>
          </View>
        ) : (
          <Txt variant="time" color={Brand.dim}>
            {fmtStart(game.startTime)}
          </Txt>
        )}
      </View>

      <View style={s.cardBody}>
        <Txt variant="title" numberOfLines={1}>
          {game.away.name} vs. {game.home.name}
        </Txt>
        <View style={s.scoreRow}>
          <SideCol
            logo={game.away.logo}
            score={game.away.score}
            abbr={game.away.abbreviation}
            pct={awayPct}
            pctColor={Brand.lime}
            align="left"
            showScore={showScore}
          />
          <View style={s.centerCol}>
            <Txt variant="time" color={Brand.dim}>
              {live ? game.statusDetail : ''}
            </Txt>
            {homePct != null && awayPct != null && (
              <View style={s.probBar}>
                <View style={[s.probSeg, { flex: awayPct, backgroundColor: Brand.lime }]} />
                <View style={[s.probSeg, { flex: homePct, backgroundColor: Brand.blue }]} />
              </View>
            )}
          </View>
          <SideCol
            logo={game.home.logo}
            score={game.home.score}
            abbr={game.home.abbreviation}
            pct={homePct}
            pctColor={Brand.blue}
            align="right"
            showScore={showScore}
          />
        </View>
      </View>
    </Pressable>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const id = useIdentity();
  const { balance, positions, refresh: refreshAccount } = useAccount();
  const [games, setGames] = useState<Game[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sportFilter, setSportFilter] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const g = await fetchGames();
      if (mounted.current) setGames(g);
    } catch {}
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(t);
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([load(), refreshAccount()]);
    setRefreshing(false);
  }, [load, refreshAccount]);

  const presentSports = useMemo(() => {
    const set = new Set(games.filter((g) => isLive(g) || isUpcoming(g)).map((g) => g.league));
    return SPORT_ORDER.filter((sp) => set.has(sp) && SPORT_CHIP[sp]);
  }, [games]);

  const { live, upcoming } = useMemo(() => {
    const vis = games.filter((g) => (sportFilter ? g.league === sportFilter : true));
    const key = (g: Game) => g.startTime ?? '';
    return {
      live: vis.filter(isLive).sort((a, b) => key(a).localeCompare(key(b))),
      upcoming: vis
        .filter((g) => !isLive(g) && isUpcoming(g))
        .sort(
          (a, b) =>
            Number(b.pregame) - Number(a.pregame) ||
            SPORT_ORDER.indexOf(a.league) - SPORT_ORDER.indexOf(b.league) ||
            key(a).localeCompare(key(b)),
        ),
    };
  }, [games, sportFilter]);

  const gameById = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);
  const liveCount = live.length;
  const totalPnl = (balance?.closedPnl ?? 0) + (balance?.unrealizedPnl ?? 0);
  const hasBets = (balance?.tradeCount ?? 0) > 0 || positions.length > 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.green} />
        }>
        <Header value={balance?.accountValue ?? null} onAvatar={() => router.push('/profile')} />
        <Greeting
          name={id.auth?.username ?? null}
          pnl={totalPnl}
          betCount={(balance?.tradeCount ?? 0) + positions.length}
          openCount={positions.length}
          hasBets={hasBets}
          liveCount={liveCount}
        />

        {positions.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.betsRow}>
            {positions.map((pos) => (
              <OpenBetCard
                key={pos.id}
                pos={pos}
                game={gameById.get(pos.gameId)}
                onPress={() => router.push(`/game/${pos.gameId}`)}
              />
            ))}
          </ScrollView>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chipsRow}>
          {presentSports.map((sp) => (
            <Chip
              key={sp}
              label={SPORT_CHIP[sp].label}
              icon={SPORT_CHIP[sp].icon}
              active={sportFilter === sp}
              onPress={() => setSportFilter(sportFilter === sp ? null : sp)}
            />
          ))}
        </ScrollView>

        <View style={s.cards}>
          {live.map((g) => (
            <GameCard key={g.id} game={g} onPress={() => router.push(`/game/${g.id}`)} />
          ))}
          {upcoming.length > 0 && (
            <Txt variant="display" style={s.upcomingHeader}>
              Upcoming
            </Txt>
          )}
          {upcoming.map((g) => (
            <GameCard key={g.id} game={g} onPress={() => router.push(`/game/${g.id}`)} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  content: { paddingBottom: NAV_SPACE },
  header: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 6,
    borderRadius: Radii.pill,
    backgroundColor: Brand.balanceGlass,
    borderWidth: 0.5,
    borderColor: Brand.hair05,
  },
  coin: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#e8b84b' },
  plusBtn: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(84,83,83,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: Brand.hair17 },

  greeting: { paddingHorizontal: 16, paddingTop: 10, gap: 6 },
  greetLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fromPill: {
    height: 22,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.md,
    backgroundColor: Brand.activeItem,
    borderWidth: 1,
    borderColor: Brand.hair03,
  },

  betsRow: { gap: 8, paddingHorizontal: 16, paddingTop: 20 },
  betCard: {
    width: 176.5,
    padding: 14,
    gap: 8,
    borderRadius: Radii.card,
    backgroundColor: Brand.cardNeutral,
    borderWidth: 1,
    borderColor: Brand.hair02,
  },
  betTeam: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  betFlag: { width: 16, height: 16, borderRadius: 8 },
  betPctPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 4,
    borderRadius: Radii.sm,
    backgroundColor: Brand.pctPillBg,
  },

  chipsRow: { gap: 4, paddingHorizontal: 16, paddingTop: 20 },
  chip: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: Radii.pill,
  },
  chipActive: {
    backgroundColor: Brand.surface,
    borderRadius: Radii.chip,
    borderWidth: 0.5,
    borderColor: Brand.hair05,
  },

  cards: { paddingHorizontal: 16, paddingTop: 20, gap: 16 },
  upcomingHeader: { marginTop: 4 },
  card: { borderRadius: Radii.card, overflow: 'hidden' },
  cardLive: { backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.greenBorder },
  cardIdle: { backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.hair05 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 12,
    paddingTop: 13,
  },
  livePill: {
    backgroundColor: Brand.green,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 22,
  },
  cardBody: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 10, gap: 12 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sideCol: { width: 80, gap: 6 },
  flagScore: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flagScoreRev: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  cardFlag: { width: 28, height: 28, borderRadius: 14 },
  sideMeta: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  centerCol: { width: 120, alignItems: 'center', gap: 8 },
  probBar: { flexDirection: 'row', width: 97, height: 6, gap: 4 },
  probSeg: { borderRadius: 3 },
});
