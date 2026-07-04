import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatPanel } from '@/components/chat-panel';
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
import { fetchChat } from '@/lib/chat';
import { cashOut } from '@/lib/trade';
import { useAccount } from '@/hooks/use-account';
import type { Position } from '@/lib/api';

const POLL_MS = 10_000;
type Tab = 'gamecast' | 'boxscore' | 'chat';
type Timeframe = 'LIVE' | '1H' | '2H' | '12H' | '1D';
const TF_MS: Record<Exclude<Timeframe, 'LIVE'>, number> = {
  '1H': 3_600_000,
  '2H': 7_200_000,
  '12H': 43_200_000,
  '1D': 86_400_000,
};

function fmtStart(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const sameDay = d.toDateString() === new Date().toDateString();
  if (sameDay) return `Today at ${time}`;
  const day = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} at ${time}`;
}

function fmtUsd(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function notify(title: string, msg: string) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(`${title}  ${msg}`);
  } else {
    Alert.alert(title, msg);
  }
}

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [tab, setTab] = useState<Tab>('gamecast');
  const [tf, setTf] = useState<Timeframe>('LIVE');
  const [chatters, setChatters] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cashOutOpen, setCashOutOpen] = useState(false);
  const [cashingOut, setCashingOut] = useState(false);
  const { positions, refresh: refreshAccount } = useAccount(10_000);
  const myPos: Position | undefined = positions.find((pos) => pos.gameId === id);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [g, h, msgs] = await Promise.all([
        fetchGameDetail(id),
        fetchOracleHistory(id),
        fetchChat(id).catch(() => []),
      ]);
      if (mounted.current) {
        setGame(g);
        setHistory(h);
        setChatters(new Set(msgs.filter((m) => m.type === 'user').map((m) => m.username)).size);
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
              position={myPos}
              windowMs={tf === 'LIVE' ? null : TF_MS[tf]}
              plays={game.plays ?? []}
              league={game.league}
            />

            <View style={styles.tfRow}>
              {(['1H', '2H', '12H', '1D', 'LIVE'] as Timeframe[]).map((t) => (
                <Pressable key={t} onPress={() => setTf(t)} hitSlop={6}>
                  <View style={[styles.tfChip, tf === t && { backgroundColor: Brand.cta }]}>
                    <ThemedText
                      type="smallBold"
                      style={{
                        color: tf === t ? Brand.ctaText : Brand.mute,
                        fontSize: 12,
                        lineHeight: 16,
                      }}>
                      {t}
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </View>

            <Pressable onPress={() => setTab('chat')} style={styles.chatTeaser}>
              <ThemedText type="small" style={{ color: Brand.dim, flex: 1 }}>
                💬 {chatters > 0 ? `${chatters} ${chatters === 1 ? 'user' : 'users'} chatting` : 'Game chat'}
              </ThemedText>
              <View style={styles.joinChatBtn}>
                <ThemedText type="smallBold" style={{ color: Brand.white, fontSize: 13 }}>
                  Join chat
                </ThemedText>
              </View>
            </Pressable>

            {myPos && (
              <Pressable onPress={() => setCashOutOpen(true)} style={styles.posRow}>
                <Image
                  source={{ uri: (myPos.side === 'home' ? game.home : game.away).logo }}
                  style={styles.posFlag}
                  contentFit="contain"
                />
                <View style={{ flex: 1, gap: 1 }}>
                  <ThemedText type="smallBold" style={{ color: Brand.white }}>
                    {(myPos.side === 'home' ? game.home : game.away).name}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: Brand.mute, fontSize: 12 }}>
                    {fmtUsd(myPos.margin)} · {myPos.leverage}x · in at{' '}
                    {Math.round((myPos.side === 'home' ? myPos.entryPx : 1 - myPos.entryPx) * 100)}%
                  </ThemedText>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 1 }}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: myPos.pnl >= 0 ? Brand.primary : Brand.red }}>
                    {myPos.pnl >= 0 ? '+' : ''}
                    {fmtUsd(myPos.pnl)}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: Brand.dim, fontSize: 12 }}>
                    Cash out ›
                  </ThemedText>
                </View>
              </Pressable>
            )}

            <View style={styles.tabsRow}>
              <TabButton label="Gamecast" active={tab === 'gamecast'} onPress={() => setTab('gamecast')} />
              <TabButton label="Box Score" active={tab === 'boxscore'} onPress={() => setTab('boxscore')} />
              <TabButton label="Chat" active={tab === 'chat'} onPress={() => setTab('chat')} />
            </View>

            {tab === 'gamecast' ? (
              <Gamecast plays={game.plays ?? []} game={game} />
            ) : tab === 'boxscore' ? (
              <BoxScore teams={game.boxscore?.teams ?? []} game={game} />
            ) : (
              <ChatPanel
                gameId={game.id}
                homeAbbr={game.home.abbreviation}
                awayAbbr={game.away.abbreviation}
              />
            )}
          </>
        )}
      </ScrollView>

      {game && homePct != null && awayPct != null && (
        <View style={styles.buyBar}>
          <Pressable
            onPress={() =>
              router.push({ pathname: '/trade/[id]', params: { id: game.id, side: 'away' } })
            }
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
            onPress={() =>
              router.push({ pathname: '/trade/[id]', params: { id: game.id, side: 'home' } })
            }
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

      {/* ── Cash-out sheet (Figma 63:3498) ─────────────────────────── */}
      <Modal
        visible={cashOutOpen && !!myPos && !!game}
        transparent
        animationType="slide"
        onRequestClose={() => setCashOutOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCashOutOpen(false)} />
        {myPos && game && (
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <ThemedText
              type="smallBold"
              style={{ color: Brand.white, fontSize: 17, textAlign: 'center' }}>
              Cash out this bet
            </ThemedText>

            <View style={{ alignItems: 'center', gap: 4 }}>
              <Image
                source={{ uri: (myPos.side === 'home' ? game.home : game.away).logo }}
                style={{ width: 48, height: 48, borderRadius: 24 }}
                contentFit="contain"
              />
              <ThemedText style={{ color: Brand.white, fontSize: 19, fontWeight: '700' }}>
                {(myPos.side === 'home' ? game.home : game.away).name}
              </ThemedText>
              <ThemedText type="small" style={{ color: Brand.mute }}>
                {fmtUsd(myPos.margin)}
              </ThemedText>
            </View>

            <View style={styles.cashOutSummary}>
              <View style={{ gap: 2 }}>
                <ThemedText type="small" style={{ color: Brand.mute }}>
                  Get back
                </ThemedText>
                <ThemedText style={{ color: Brand.white, fontSize: 24, fontWeight: '700' }}>
                  {fmtUsd(myPos.margin + myPos.pnl)}
                </ThemedText>
              </View>
              <View style={{ gap: 2, alignItems: 'flex-end' }}>
                <ThemedText type="small" style={{ color: Brand.mute }}>
                  Profit
                </ThemedText>
                <ThemedText
                  style={{
                    color: myPos.pnl >= 0 ? Brand.primary : Brand.red,
                    fontSize: 24,
                    fontWeight: '700',
                  }}>
                  {myPos.pnl >= 0 ? '+' : ''}
                  {fmtUsd(myPos.pnl)}
                </ThemedText>
              </View>
            </View>

            <Pressable
              disabled={cashingOut}
              onPress={async () => {
                if (!myPos || cashingOut) return;
                setCashingOut(true);
                try {
                  await cashOut(game.id, myPos.side, myPos.size);
                  setCashOutOpen(false);
                  await refreshAccount();
                  notify('Cashed out ✓', `You got back ~${fmtUsd(myPos.margin + myPos.pnl)}`);
                } catch (e) {
                  notify('Cash out failed', e instanceof Error ? e.message : 'Try again.');
                } finally {
                  setCashingOut(false);
                }
              }}
              style={[styles.cashOutBtn, cashingOut && { opacity: 0.5 }]}>
              <ThemedText style={{ color: Brand.ctaText, fontSize: 17, fontWeight: '700' }}>
                {cashingOut ? 'Cashing out…' : `Cash out ${fmtUsd(myPos.margin + myPos.pnl)}`}
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => setCashOutOpen(false)} style={styles.keepOpenBtn}>
              <ThemedText style={{ color: Brand.white, fontWeight: '600' }}>Keep it open</ThemedText>
            </Pressable>
          </View>
        )}
      </Modal>
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
  tfRow: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'flex-end' },
  tfChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Brand.chip,
  },
  chatTeaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Brand.card,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: Spacing.three,
    paddingRight: 6,
    paddingVertical: 6,
  },
  joinChatBtn: {
    backgroundColor: Brand.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
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
  posRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Brand.card,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.two + 4,
  },
  posFlag: { width: 30, height: 30, borderRadius: 15 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#121316',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: Brand.border2,
  },
  cashOutSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Brand.surface,
    borderRadius: 16,
    padding: Spacing.three,
  },
  cashOutBtn: {
    backgroundColor: Brand.cta,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  keepOpenBtn: {
    backgroundColor: Brand.surface,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
