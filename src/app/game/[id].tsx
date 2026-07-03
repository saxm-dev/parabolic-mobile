import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProbChart } from '@/components/prob-chart';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import {
  fetchGameDetail,
  fetchOracleHistory,
  type BoxTeam,
  type GameDetail,
  type HistoryPoint,
  type Play,
} from '@/lib/api';

const POLL_MS = 10_000;
type Tab = 'gamecast' | 'boxscore';

function fmtStart(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const sameDay = d.toDateString() === new Date().toDateString();
  if (sameDay) return `Today at ${time}`;
  const day = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} at ${time}`;
}

function notifyTradingSoon() {
  const msg = 'Order entry ships in the next build — trading is live on app.parabolic.gg today.';
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(msg);
  } else {
    Alert.alert('Coming soon', msg);
  }
}

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [tab, setTab] = useState<Tab>('gamecast');
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [g, h] = await Promise.all([fetchGameDetail(id), fetchOracleHistory(id)]);
      if (mounted.current) {
        setGame(g);
        setHistory(h);
        setError(null);
      }
    } catch {
      if (mounted.current) setError('Unable to load this game right now.');
    }
  }, [id]);

  useEffect(() => {
    mounted.current = true;
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(t);
    };
  }, [load]);

  const live = game?.status === 'live' || game?.status === 'in';
  const final = game?.status === 'final';
  const showScores = live || final;

  const prob = useMemo(() => {
    const o = game?.oracle;
    if (!o) return null;
    const p = o.markPrice > 0 ? o.markPrice : o.indexPrice;
    if (!p || p <= 0 || p >= 1) return null;
    return p;
  }, [game]);
  const homePct = prob == null ? null : Math.round(prob * 100);
  const awayPct = homePct == null ? null : 100 - homePct;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.navRow}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <ThemedText style={{ color: Brand.white, fontSize: 20, lineHeight: 24 }}>←</ThemedText>
        </Pressable>
        {game && (
          <ThemedText type="small" style={{ color: Brand.mute, letterSpacing: 1.2 }}>
            {game.leagueDisplay.toUpperCase()}
          </ThemedText>
        )}
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {!game ? (
          <ThemedText type="small" style={styles.centerNote}>
            {error ?? 'Loading…'}
          </ThemedText>
        ) : (
          <>
            <View style={styles.scoreboard}>
              <View style={styles.teamCol}>
                <Image source={{ uri: game.away.logo }} style={styles.bigFlag} contentFit="contain" />
                <ThemedText style={styles.teamName} numberOfLines={1}>
                  {game.away.name}
                </ThemedText>
                {!!game.away.record && (
                  <ThemedText type="small" style={{ color: Brand.mute }}>
                    {game.away.record}
                  </ThemedText>
                )}
              </View>

              <View style={styles.centerCol}>
                {showScores ? (
                  <>
                    <ThemedText style={styles.bigScore}>
                      {game.away.score}
                      <ThemedText style={[styles.bigScore, { color: Brand.mute }]}> – </ThemedText>
                      {game.home.score}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: Brand.dim }}>
                      {game.statusDetail}
                    </ThemedText>
                    {live && (
                      <View style={styles.livePill}>
                        <ThemedText
                          type="smallBold"
                          style={{ color: '#fff', fontSize: 12, lineHeight: 16 }}>
                          LIVE
                        </ThemedText>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <ThemedText style={{ color: Brand.dim, fontSize: 16, lineHeight: 22 }}>
                      {fmtStart(game.startTime)}
                    </ThemedText>
                    {game.pregame && (
                      <View style={[styles.livePill, { backgroundColor: 'rgba(255,82,71,0.16)' }]}>
                        <ThemedText
                          type="smallBold"
                          style={{ color: Brand.red, fontSize: 12, lineHeight: 16 }}>
                          PRE-GAME
                        </ThemedText>
                      </View>
                    )}
                  </>
                )}
              </View>

              <View style={styles.teamCol}>
                <Image source={{ uri: game.home.logo }} style={styles.bigFlag} contentFit="contain" />
                <ThemedText style={styles.teamName} numberOfLines={1}>
                  {game.home.name}
                </ThemedText>
                {!!game.home.record && (
                  <ThemedText type="small" style={{ color: Brand.mute }}>
                    {game.home.record}
                  </ThemedText>
                )}
              </View>
            </View>

            <ProbChart
              history={history}
              homeAbbr={game.home.abbreviation}
              awayAbbr={game.away.abbreviation}
            />

            <View style={styles.tabsRow}>
              <TabButton label="Gamecast" active={tab === 'gamecast'} onPress={() => setTab('gamecast')} />
              <TabButton label="Box Score" active={tab === 'boxscore'} onPress={() => setTab('boxscore')} />
            </View>

            {tab === 'gamecast' ? (
              <Gamecast plays={game.plays ?? []} game={game} />
            ) : (
              <BoxScore teams={game.boxscore?.teams ?? []} game={game} />
            )}
          </>
        )}
      </ScrollView>

      {game && homePct != null && awayPct != null && (
        <View style={styles.buyBar}>
          <Pressable
            onPress={notifyTradingSoon}
            style={[styles.buyBtn, { backgroundColor: 'rgba(233,167,247,0.14)' }]}>
            <Image source={{ uri: game.away.logo }} style={styles.buyFlag} contentFit="contain" />
            <ThemedText type="smallBold" style={{ color: Brand.sideAway, fontSize: 16, lineHeight: 22 }}>
              {awayPct}%
            </ThemedText>
            <ThemedText type="small" style={{ color: Brand.dim }}>
              {game.away.abbreviation}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={notifyTradingSoon}
            style={[styles.buyBtn, { backgroundColor: 'rgba(124,192,244,0.14)' }]}>
            <Image source={{ uri: game.home.logo }} style={styles.buyFlag} contentFit="contain" />
            <ThemedText type="smallBold" style={{ color: Brand.sideHome, fontSize: 16, lineHeight: 22 }}>
              {homePct}%
            </ThemedText>
            <ThemedText type="small" style={{ color: Brand.dim }}>
              {game.home.abbreviation}
            </ThemedText>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      <ThemedText
        style={{
          color: active ? Brand.white : Brand.mute,
          fontSize: 17,
          lineHeight: 24,
          fontWeight: active ? '700' : '500',
        }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Gamecast({ plays, game }: { plays: Play[]; game: GameDetail }) {
  if (!plays.length) {
    return (
      <ThemedText type="small" style={styles.centerNote}>
        {game.status === 'scheduled' || game.pregame
          ? 'The gamecast starts at kickoff.'
          : 'No plays yet.'}
      </ThemedText>
    );
  }
  const recent = [...plays].reverse().slice(0, 40);
  return (
    <View style={{ gap: Spacing.two }}>
      {recent.map((p) => (
        <View
          key={p.id}
          style={[styles.playRow, p.scoringPlay && { borderColor: Brand.primary, borderWidth: 1 }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText type="small" style={{ color: p.scoringPlay ? Brand.white : Brand.dim }}>
              {p.text}
            </ThemedText>
            <ThemedText type="small" style={{ color: Brand.mute, fontSize: 12, lineHeight: 16 }}>
              {p.periodDisplay}
              {p.clock ? ` · ${p.clock}` : ''}
              {p.scoringPlay ? ` · ${p.awayScore}-${p.homeScore}` : ''}
            </ThemedText>
          </View>
          {p.scoringPlay && (
            <ThemedText type="smallBold" style={{ color: Brand.primary }}>
              +{p.scoreValue || ''}
            </ThemedText>
          )}
        </View>
      ))}
    </View>
  );
}

function BoxScore({ teams, game }: { teams: BoxTeam[]; game: GameDetail }) {
  if (teams.length < 2) {
    return (
      <ThemedText type="small" style={styles.centerNote}>
        Box score appears once the game is underway.
      </ThemedText>
    );
  }
  // Backend order matches ESPN: [away, home]... but match names defensively.
  const away = teams.find((t) => t.team === game.away.name) ?? teams[0];
  const home = teams.find((t) => t.team === game.home.name && t !== away) ?? teams[1];
  const rows = away.stats
    .map((s) => ({
      label: s.displayName,
      away: s.value,
      home: home.stats.find((hs) => hs.name === s.name)?.value ?? '–',
    }))
    .slice(0, 16);

  return (
    <View style={{ gap: 2 }}>
      <View style={styles.boxHeader}>
        <ThemedText type="smallBold" style={{ color: Brand.sideAway }}>
          {game.away.abbreviation}
        </ThemedText>
        <ThemedText type="small" style={{ color: Brand.mute }}>
          Team stats
        </ThemedText>
        <ThemedText type="smallBold" style={{ color: Brand.sideHome }}>
          {game.home.abbreviation}
        </ThemedText>
      </View>
      {rows.map((r) => (
        <View key={r.label} style={styles.boxRow}>
          <ThemedText type="smallBold" style={{ color: Brand.white, width: 60 }}>
            {r.away}
          </ThemedText>
          <ThemedText type="small" style={{ color: Brand.dim, flex: 1, textAlign: 'center' }}>
            {r.label}
          </ThemedText>
          <ThemedText type="smallBold" style={{ color: Brand.white, width: 60, textAlign: 'right' }}>
            {r.home}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: 120,
    gap: Spacing.three,
  },
  scoreboard: { flexDirection: 'row', alignItems: 'flex-start' },
  teamCol: { flex: 1, alignItems: 'center', gap: 4 },
  centerCol: { flex: 1.1, alignItems: 'center', gap: 6, paddingTop: Spacing.two },
  bigFlag: { width: 56, height: 56, borderRadius: 28 },
  teamName: { color: Brand.white, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  bigScore: { color: Brand.white, fontSize: 40, lineHeight: 46, fontWeight: '800' },
  livePill: {
    backgroundColor: Brand.livePill,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  tabsRow: { flexDirection: 'row', gap: Spacing.four },
  playRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Brand.card,
    borderRadius: 12,
    padding: Spacing.two + 4,
  },
  boxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  boxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.card,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
  },
  centerNote: { color: Brand.mute, textAlign: 'center', marginTop: Spacing.four },
  buyBar: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.three,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  buyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 14,
  },
  buyFlag: { width: 22, height: 22, borderRadius: 11 },
});
