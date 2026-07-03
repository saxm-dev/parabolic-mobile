import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { fetchGames, type Game } from '@/lib/api';
import { BottomTabInset, Brand, Spacing } from '@/constants/theme';

const POLL_MS = 15_000;

/** Seasonal sport ordering for upcoming sections (mirrors web home page). */
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
  if (sameDay) return `Today · ${time}`;
  if (isTomorrow) return `Tomorrow · ${time}`;
  const day = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} · ${time}`;
}

/** Home win probability 0..1 from the oracle (mark first, index fallback). */
function homeProb(g: Game): number | null {
  const o = g.oracle;
  if (!o) return null;
  const p = o.markPrice > 0 ? o.markPrice : o.indexPrice;
  if (!p || p <= 0 || p >= 1) return null;
  return p;
}

function ProbBar({ game }: { game: Game }) {
  const p = homeProb(game);
  if (p == null) return null;
  const homePct = Math.round(p * 100);
  const awayPct = 100 - homePct;
  return (
    <View style={styles.probWrap}>
      <View style={styles.probLabels}>
        <ThemedText type="small" style={{ color: Brand.primary }}>
          {game.home.abbreviation} {homePct}%
        </ThemedText>
        <ThemedText type="small" style={{ color: Brand.red }}>
          {awayPct}% {game.away.abbreviation}
        </ThemedText>
      </View>
      <View style={styles.probTrack}>
        <View style={[styles.probFill, { flex: homePct, backgroundColor: Brand.primary }]} />
        <View style={[styles.probFill, { flex: awayPct, backgroundColor: Brand.red }]} />
      </View>
    </View>
  );
}

function TeamRow({ side, isHome }: { side: Game['home']; isHome: boolean }) {
  return (
    <View style={styles.teamRow}>
      <Image source={{ uri: side.logo }} style={styles.logo} contentFit="contain" />
      <ThemedText style={styles.teamName} numberOfLines={1}>
        {side.name}
      </ThemedText>
      {isHome && <ThemedText type="small" style={{ color: Brand.mute }}>HOME</ThemedText>}
      <ThemedText style={styles.score}>{side.score ?? ''}</ThemedText>
    </View>
  );
}

function StatusPill({ game }: { game: Game }) {
  if (isLive(game)) {
    return (
      <View style={[styles.pill, { backgroundColor: 'rgba(31,209,130,0.12)' }]}>
        <View style={styles.liveDot} />
        <ThemedText type="smallBold" style={{ color: Brand.primary }}>
          LIVE · {game.statusDetail}
        </ThemedText>
      </View>
    );
  }
  if (game.pregame) {
    return (
      <View style={[styles.pill, { backgroundColor: 'rgba(255,82,71,0.12)' }]}>
        <ThemedText type="smallBold" style={{ color: Brand.red }}>
          PRE-GAME · {fmtStart(game.startTime)}
        </ThemedText>
      </View>
    );
  }
  return (
    <ThemedText type="small" style={{ color: Brand.dim }}>
      {fmtStart(game.startTime)}
    </ThemedText>
  );
}

function GameCard({ game }: { game: Game }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText type="small" style={{ color: Brand.mute }}>
          {game.leagueDisplay}
        </ThemedText>
        <StatusPill game={game} />
      </View>
      <TeamRow side={game.away} isHome={false} />
      <TeamRow side={game.home} isHome />
      <ProbBar game={game} />
    </View>
  );
}

type Section = { title: string; accent: string; data: Game[] };

export default function MarketsScreen() {
  const [games, setGames] = useState<Game[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const sections = useMemo<Section[]>(() => {
    const live = games
      .filter(isLive)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    const upcoming = games
      .filter((g) => !isLive(g) && isUpcoming(g))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const out: Section[] = [];
    if (live.length) out.push({ title: '● LIVE', accent: Brand.primary, data: live });
    for (const league of SPORT_ORDER) {
      const bucket = upcoming.filter((g) => g.league === league);
      // Pregame (tradeable soon) first within each sport
      bucket.sort((a, b) => Number(b.pregame) - Number(a.pregame) || a.startTime.localeCompare(b.startTime));
      if (bucket.length) {
        out.push({ title: SPORT_LABEL[league] ?? g0(bucket), accent: Brand.dim, data: bucket });
      }
    }
    const known = new Set(SPORT_ORDER);
    const other = upcoming.filter((g) => !known.has(g.league));
    if (other.length) out.push({ title: 'More', accent: Brand.dim, data: other });
    return out;
  }, [games]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <ThemedText type="subtitle" style={styles.wordmark}>
          parabolic
        </ThemedText>
      </View>
      {error && (
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
      )}
      <SectionList
        sections={sections}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => <GameCard game={item} />}
        renderSectionHeader={({ section }) => (
          <ThemedText type="smallBold" style={[styles.sectionTitle, { color: section.accent }]}>
            {section.title}
          </ThemedText>
        )}
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

function g0(bucket: Game[]): string {
  return bucket[0]?.leagueDisplay ?? 'Other';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  header: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  wordmark: { color: Brand.white, fontSize: 24, lineHeight: 32, letterSpacing: 0.5 },
  error: {
    color: Brand.red,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.two,
  },
  sectionTitle: {
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: Brand.card,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  logo: { width: 24, height: 24 },
  teamName: { flex: 1, color: Brand.white },
  score: { color: Brand.white, fontVariant: ['tabular-nums'], minWidth: 28, textAlign: 'right' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Brand.primary },
  probWrap: { gap: 4, marginTop: Spacing.one },
  probLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  probTrack: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    gap: 2,
  },
  probFill: { borderRadius: 3 },
  empty: {
    color: Brand.dim,
    textAlign: 'center',
    marginTop: Spacing.five,
  },
});
