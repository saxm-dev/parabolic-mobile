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
import { fetchGames, type Game } from '@/lib/api';

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

/** Home win probability 0..1 from the oracle (mark first, index fallback). */
function homeProb(g: Game): number | null {
  const o = g.oracle;
  if (!o) return null;
  const p = o.markPrice > 0 ? o.markPrice : o.indexPrice;
  if (!p || p <= 0 || p >= 1) return null;
  return p;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
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

type Section = { title: string | null; data: Game[] };

export default function HomeScreen() {
  const router = useRouter();
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
    await load();
    setRefreshing(false);
  }, [load]);

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
            </View>
            <View style={styles.greetingWrap}>
              <ThemedText style={styles.greeting}>{greeting()}</ThemedText>
              <ThemedText style={styles.greetingSub}>
                {liveCount > 0
                  ? `${liveCount} ${liveCount === 1 ? 'game is' : 'games are'} live right now`
                  : 'Markets open before kickoff'}
              </ThemedText>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}>
              <Chip label="All" active={sportFilter == null} onPress={() => setSportFilter(null)} />
              {presentSports.map((s) => (
                <Chip
                  key={s}
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

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: Brand.cta }]}>
      <ThemedText type="smallBold" style={{ color: active ? Brand.ctaText : Brand.dim }}>
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
  greetingWrap: { marginTop: Spacing.two, marginBottom: Spacing.three, gap: 2 },
  greeting: { color: Brand.white, fontSize: 28, lineHeight: 34, fontWeight: '700' },
  greetingSub: { color: Brand.dim, fontSize: 16, lineHeight: 24, fontWeight: '500' },
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
  empty: { color: Brand.dim, textAlign: 'center', marginTop: Spacing.five },
});
