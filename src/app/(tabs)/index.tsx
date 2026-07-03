import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Brand, Spacing } from '@/constants/theme';
import { useAccount } from '@/hooks/use-account';
import { useIdentity } from '@/hooks/use-identity';
import { fetchGames, type Game, type Position } from '@/lib/api';

const POLL_MS = 15_000;

/** Seasonal sport ordering (mirrors web home page). */
const SPORT_ORDER = ['wcup', 'mlb', 'nfl', 'nba', 'ncaam', 'nhl', 'mls'];
const SPORT_LABEL: Record<string, string> = {
  wcup: 'World Cup',
  mlb: 'Baseball',
  nfl: 'Football',
  nba: 'Basketball',
  ncaam: 'College Basketball',
  nhl: 'Hockey',
  mls: 'Soccer',
};
const SPORT_ICON: Record<string, string> = {
  wcup: '⚽',
  mlb: '⚾',
  nfl: '🏈',
  nba: '🏀',
  ncaam: '🏀',
  nhl: '🏒',
  mls: '⚽',
};

function isLive(g: Game) {
  return g.status === 'live' || g.status === 'in';
}
function isUpcoming(g: Game) {
  return g.status === 'scheduled' || g.status === 'pre' || g.pregame;
}

function fmtStart(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now.getTime() + 86_400_000);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today at ${time}`;
  if (isTomorrow) return `Tomorrow at ${time}`;
  const day = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} at ${time}`;
}

function fmtUsd(n: number, digits = 2): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

/** Home win probability 0..1 from the oracle (mark first, index fallback). */
function homeProb(g: Game): number | null {
  const o = g.oracle;
  if (!o) return null;
  const p = o.markPrice > 0 ? o.markPrice : o.indexPrice;
  if (!p || p <= 0 || p >= 1) return null;
  return p;
}

function greeting(name?: string | null): string {
  const h = new Date().getHours();
  const base = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${base}, ${name}` : base;
}

function GameCard({ game, onPress }: { game: Game; onPress: () => void }) {
  const p = homeProb(game);
  const homePct = p == null ? null : Math.round(p * 100);
  const awayPct = homePct == null ? null : 100 - homePct;
  const live = isLive(game);
  const showScores = live || game.status === 'final';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <View style={styles.cardTop}>
        <ThemedText type="small" style={styles.leagueLabel}>
          {game.leagueDisplay.toUpperCase()}
        </ThemedText>
        {live && (
          <View style={styles.livePill}>
            <ThemedText type="smallBold" style={{ color: '#fff', fontSize: 12, lineHeight: 16 }}>
              LIVE
            </ThemedText>
          </View>
        )}
      </View>

      <ThemedText style={styles.matchTitle} numberOfLines={1}>
        {game.away.name} vs. {game.home.name}
      </ThemedText>

      <View style={styles.scoreRow}>
        <View style={styles.sideCol}>
          <Image source={{ uri: game.away.logo }} style={styles.flag} contentFit="contain" />
          {showScores && <ThemedText style={styles.score}>{game.away.score}</ThemedText>}
        </View>

        <View style={styles.centerCol}>
          <ThemedText type="small" style={{ color: Brand.dim, textAlign: 'center' }}>
            {live ? game.statusDetail : fmtStart(game.startTime)}
          </ThemedText>
        </View>

        <View style={[styles.sideCol, { flexDirection: 'row-reverse' }]}>
          <Image source={{ uri: game.home.logo }} style={styles.flag} contentFit="contain" />
          {showScores && <ThemedText style={styles.score}>{game.home.score}</ThemedText>}
        </View>
      </View>

      {homePct != null && awayPct != null && (
        <View style={styles.probRow}>
          <ThemedText type="smallBold" style={{ color: Brand.sideAway, minWidth: 80 }}>
            {game.away.abbreviation} {awayPct}%
          </ThemedText>
          <View style={styles.probTrack}>
            <View style={{ flex: awayPct, backgroundColor: Brand.sideAway, borderRadius: 2 }} />
            <View style={{ flex: homePct, backgroundColor: Brand.sideHome, borderRadius: 2 }} />
          </View>
          <ThemedText
            type="smallBold"
            style={{ color: Brand.sideHome, minWidth: 80, textAlign: 'right' }}>
            {homePct}% {game.home.abbreviation}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

function OpenBetCard({
  pos,
  game,
  onPress,
}: {
  pos: Position;
  game: Game | undefined;
  onPress: () => void;
}) {
  const team = game ? (pos.side === 'home' ? game.home : game.away) : null;
  const up = pos.pnl >= 0;
  return (
    <Pressable onPress={onPress} style={styles.betCard}>
      <View style={styles.betCardTeam}>
        {team && <Image source={{ uri: team.logo }} style={styles.betFlag} contentFit="contain" />}
        <ThemedText numberOfLines={1} style={{ color: Brand.white, fontWeight: '600', flex: 1 }}>
          {team?.name ?? pos.side.toUpperCase()}
        </ThemedText>
      </View>
      <ThemedText type="smallBold" style={{ color: up ? Brand.primary : Brand.red, fontSize: 17 }}>
        {up ? '+' : ''}
        {fmtUsd(pos.pnl)}
      </ThemedText>
      <View style={styles.betPctPill}>
        <ThemedText type="smallBold" style={{ color: up ? Brand.primary : Brand.red, fontSize: 12 }}>
          {up ? '+' : ''}
          {pos.roe.toFixed(1)}%
        </ThemedText>
      </View>
    </Pressable>
  );
}

type Section = { title: string | null; data: Game[] };

export default function HomeScreen() {
  const router = useRouter();
  const id = useIdentity();
  const { balance, positions, refresh: refreshAccount } = useAccount();
  const [games, setGames] = useState<Game[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sportFilter, setSportFilter] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const g = await fetchGames();
      if (mounted.current) {
        setGames(g);
        setError(null);
      }
    } catch {
      if (mounted.current) setError('Unable to reach the exchange. Pull to retry.');
    }
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
    return SPORT_ORDER.filter((s) => set.has(s));
  }, [games]);

  const sections = useMemo<Section[]>(() => {
    const visible = games.filter((g) => (sportFilter ? g.league === sportFilter : true));
    const startKey = (g: Game) => g.startTime ?? '';
    const live = visible.filter(isLive).sort((a, b) => startKey(a).localeCompare(startKey(b)));
    const upcoming = visible
      .filter((g) => !isLive(g) && isUpcoming(g))
      .sort(
        (a, b) =>
          Number(b.pregame) - Number(a.pregame) ||
          SPORT_ORDER.indexOf(a.league) - SPORT_ORDER.indexOf(b.league) ||
          startKey(a).localeCompare(startKey(b)),
      );
    const out: Section[] = [];
    if (live.length) out.push({ title: null, data: live });
    if (upcoming.length) out.push({ title: 'Upcoming', data: upcoming });
    return out;
  }, [games, sportFilter]);

  const liveCount = useMemo(() => games.filter(isLive).length, [games]);
  const gameById = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);

  const totalPnl = (balance?.closedPnl ?? 0) + (balance?.unrealizedPnl ?? 0);
  const hasBets = (balance?.tradeCount ?? 0) > 0 || positions.length > 0;
  const displayName = id.auth?.username ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SectionList
        sections={sections}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => (
          <GameCard game={item} onPress={() => router.push(`/game/${item.id}`)} />
        )}
        renderSectionHeader={({ section }) =>
          section.title ? (
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              {section.title}
            </ThemedText>
          ) : null
        }
        ListHeaderComponent={
          <View>
            <View style={styles.topBar}>
              <ThemedText style={styles.wordmark}>parabolic</ThemedText>
              <View style={styles.topRight}>
                {balance && (
                  <View style={styles.balancePill}>
                    <View style={styles.coin}>
                      <ThemedText style={styles.coinText}>$</ThemedText>
                    </View>
                    <ThemedText type="smallBold" style={{ color: Brand.white }}>
                      {fmtUsd(balance.accountValue)}
                    </ThemedText>
                  </View>
                )}
                <Pressable onPress={() => router.push('/profile')} style={styles.avatar} hitSlop={6}>
                  <ThemedText type="smallBold" style={{ color: Brand.white }}>
                    {(displayName ?? 'G')[0]!.toUpperCase()}
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            <View style={styles.greetingWrap}>
              <ThemedText style={styles.greeting}>{greeting(displayName)}</ThemedText>
              {hasBets && balance ? (
                <View style={styles.pnlRow}>
                  <ThemedText style={styles.greetingSub}>
                    You’re{' '}
                    <ThemedText
                      style={[
                        styles.greetingSub,
                        { color: totalPnl >= 0 ? Brand.primary : Brand.red, fontWeight: '700' },
                      ]}>
                      {totalPnl >= 0 ? '+' : ''}
                      {fmtUsd(totalPnl, 0)}
                    </ThemedText>
                  </ThemedText>
                  <View style={styles.fromPill}>
                    <ThemedText type="smallBold" style={{ color: Brand.dim, fontSize: 12 }}>
                      FROM {balance.tradeCount + positions.length} BET
                      {balance.tradeCount + positions.length === 1 ? '' : 'S'}
                    </ThemedText>
                  </View>
                </View>
              ) : null}
              <ThemedText style={styles.greetingSub}>
                {positions.length > 0
                  ? `${positions.length} open bet${positions.length === 1 ? '' : 's'} still in play`
                  : liveCount > 0
                    ? `${liveCount} ${liveCount === 1 ? 'game is' : 'games are'} live right now`
                    : 'Markets open before kickoff'}
              </ThemedText>
            </View>

            {positions.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.betsRow}>
                {positions.map((p) => (
                  <OpenBetCard
                    key={p.id}
                    pos={p}
                    game={gameById.get(p.gameId)}
                    onPress={() => router.push(`/game/${p.gameId}`)}
                  />
                ))}
              </ScrollView>
            )}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}>
              <Chip label="All" active={sportFilter == null} onPress={() => setSportFilter(null)} />
              {presentSports.map((s) => (
                <Chip
                  key={s}
                  icon={SPORT_ICON[s]}
                  label={SPORT_LABEL[s] ?? s.toUpperCase()}
                  active={sportFilter === s}
                  onPress={() => setSportFilter(sportFilter === s ? null : s)}
                />
              ))}
            </ScrollView>
            {error && (
              <ThemedText type="small" style={styles.error}>
                {error}
              </ThemedText>
            )}
          </View>
        }
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />
        }
        ListEmptyComponent={
          <ThemedText type="small" style={styles.empty}>
            {error ? '' : 'Loading markets…'}
          </ThemedText>
        }
      />
    </SafeAreaView>
  );
}

function Chip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon?: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: Brand.cta }]}>
      <ThemedText type="smallBold" style={{ color: active ? Brand.ctaText : Brand.dim }}>
        {icon ? `${icon} ` : ''}
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  wordmark: {
    color: Brand.white,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Brand.surface,
    borderRadius: 999,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 5,
  },
  coin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Brand.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinText: { color: '#1a1c0e', fontSize: 13, lineHeight: 16, fontWeight: '800' },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Brand.surface,
    borderWidth: 1,
    borderColor: Brand.border2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingWrap: { marginTop: Spacing.two, marginBottom: Spacing.three, gap: 4 },
  greeting: { color: Brand.white, fontSize: 28, lineHeight: 34, fontWeight: '700' },
  pnlRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  fromPill: {
    backgroundColor: Brand.surface,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  greetingSub: { color: Brand.dim, fontSize: 18, lineHeight: 26, fontWeight: '600' },
  betsRow: { gap: Spacing.two, paddingBottom: Spacing.three },
  betCard: {
    width: 168,
    backgroundColor: Brand.card,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    gap: 6,
  },
  betCardTeam: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  betFlag: { width: 22, height: 22, borderRadius: 11 },
  betPctPill: {
    alignSelf: 'flex-start',
    backgroundColor: Brand.surface,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipsRow: { gap: Spacing.two, paddingBottom: Spacing.two },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: Brand.chip,
  },
  error: { color: Brand.red, paddingVertical: Spacing.two },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.two,
  },
  sectionTitle: {
    color: Brand.white,
    fontSize: 18,
    lineHeight: 26,
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  card: {
    backgroundColor: Brand.card,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  leagueLabel: { color: Brand.mute, letterSpacing: 1.2, fontSize: 12, lineHeight: 16 },
  livePill: {
    backgroundColor: Brand.livePill,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  matchTitle: { color: Brand.white, fontSize: 17, lineHeight: 24, fontWeight: '600' },
  scoreRow: { flexDirection: 'row', alignItems: 'center' },
  sideCol: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flex: 1 },
  centerCol: { flex: 1.2, alignItems: 'center' },
  flag: { width: 36, height: 36, borderRadius: 18 },
  score: { color: Brand.white, fontSize: 28, lineHeight: 34, fontWeight: '700' },
  probRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  probTrack: {
    flex: 1,
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    gap: 3,
  },
  probFill: { borderRadius: 3 },
  empty: { color: Brand.dim, textAlign: 'center', marginTop: Spacing.five },
});
