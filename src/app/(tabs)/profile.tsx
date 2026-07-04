import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Sym } from '@/components/sym';
import { Txt } from '@/components/txt';
import { Brand, Radii } from '@/constants/theme';
import { useAccount } from '@/hooks/use-account';
import { useIdentity } from '@/hooks/use-identity';
import { fetchGames, fetchTrades, type ClosedTrade, type Game, type Position } from '@/lib/api';

type Tab = 'bets' | 'badges' | 'stats';

function fmtUsd(n: number, digits = 0): string {
  const s = n < 0 ? '-' : '';
  return `${s}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function PositionRow({ pos, game }: { pos: Position; game?: Game }) {
  const team = game ? (pos.side === 'home' ? game.home : game.away) : null;
  const up = pos.pnl >= 0;
  const entry = Math.round((pos.side === 'home' ? pos.entryPx : 1 - pos.entryPx) * 100);
  return (
    <View style={styles.posRow}>
      {team && <Image source={{ uri: team.logo }} style={styles.posFlag} contentFit="contain" />}
      <View style={{ flex: 1, gap: 1 }}>
        <Txt variant="title" color={Brand.white}>
          {team?.name ?? pos.side.toUpperCase()}
        </Txt>
        <Txt variant="label" color={Brand.dim}>
          {fmtUsd(pos.margin, 2)} · {entry}%
        </Txt>
      </View>
      <Txt variant="title" color={up ? Brand.green : Brand.red} style={{ fontWeight: '600' }}>
        {up ? '+' : ''}
        {pos.roe.toFixed(1)}%
      </Txt>
    </View>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Txt variant="label" color={Brand.dim}>
        {label}
      </Txt>
      <Txt variant="display" color={color ?? Brand.white} style={{ fontSize: 20, lineHeight: 24 }}>
        {value}
      </Txt>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const id = useIdentity();
  const { balance, positions, refresh } = useAccount(15_000);
  const [games, setGames] = useState<Game[]>([]);
  const [trades, setTrades] = useState<ClosedTrade[]>([]);
  const [tab, setTab] = useState<Tab>('stats');
  const [refreshing, setRefreshing] = useState(false);

  const loadAux = useCallback(async () => {
    try {
      setGames(await fetchGames());
    } catch {}
    const uid = id.auth?.userId ?? id.guestId;
    if (uid) setTrades(await fetchTrades(uid));
  }, [id.auth?.userId, id.guestId]);

  useEffect(() => {
    loadAux();
  }, [loadAux]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), loadAux()]);
    setRefreshing(false);
  }, [refresh, loadAux]);

  const gameById = new Map(games.map((g) => [g.id, g]));
  const totalPnl = (balance?.closedPnl ?? 0) + (balance?.unrealizedPnl ?? 0);
  const roi = balance ? ((balance.accountValue - 10_000) / 10_000) * 100 : 0;
  const wins = trades.filter((t) => t.pnl > 0).length;
  const winRate = trades.length ? Math.round((wins / trades.length) * 100) : null;
  const username = id.auth?.username ?? 'Guest';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.green} />
        }>
        {/* Identity */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Sym name="person.fill" size={38} color="#0c0c0c" />
          </View>
          <View style={styles.tag}>
            <Txt variant="caps" color="#0a0a0a" upper style={{ fontWeight: '700' }}>
              Trader
            </Txt>
          </View>
          <View style={styles.nameRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="display" color={Brand.white} style={{ fontSize: 26, lineHeight: 30 }}>
                {username}
              </Txt>
              <Txt variant="label" color={Brand.dim}>
                {balance ? `${balance.tradeCount} trades · ${fmtUsd(balance.totalVolume)} volume` : ' '}
              </Txt>
            </View>
            <Pressable style={styles.settingsBtn} onPress={() => router.push('/settings')}>
              <Txt variant="body" color={Brand.ctaText} style={{ fontWeight: '600' }}>
                Settings
              </Txt>
            </Pressable>
          </View>
        </View>

        {id.auth == null && (
          <Pressable style={styles.claimBanner} onPress={() => router.push('/auth/signup')}>
            <Sym name="sparkles" size={18} color={Brand.green} />
            <Txt variant="label" color={Brand.white} style={{ flex: 1 }}>
              Create an account to save your progress
            </Txt>
            <Sym name="chevron.right" size={16} color={Brand.dim} />
          </Pressable>
        )}

        {/* Performance */}
        <View style={styles.perfCard}>
          <View style={styles.perfTop}>
            <View style={{ gap: 2 }}>
              <Txt variant="label" color={Brand.dim}>
                Account value
              </Txt>
              <Txt variant="display" color={Brand.white} style={{ fontSize: 28, lineHeight: 32 }}>
                {balance ? fmtUsd(balance.accountValue, 2) : '—'}
              </Txt>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Txt variant="label" color={Brand.dim}>
                All-time
              </Txt>
              <Txt
                variant="display"
                color={totalPnl >= 0 ? Brand.green : Brand.red}
                style={{ fontSize: 20, lineHeight: 24 }}>
                {totalPnl >= 0 ? '+' : ''}
                {fmtUsd(totalPnl, 2)}
              </Txt>
            </View>
          </View>
        </View>

        {/* Open positions */}
        {positions.length > 0 && (
          <View style={styles.section}>
            <Txt variant="title" color={Brand.white} style={{ fontWeight: '600' }}>
              Open positions
            </Txt>
            <View style={styles.posList}>
              {positions.map((p) => (
                <PositionRow key={p.id} pos={p} game={gameById.get(p.gameId)} />
              ))}
            </View>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['bets', 'badges', 'stats'] as Tab[]).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} hitSlop={6}>
              <Txt
                variant="title"
                color={tab === t ? Brand.white : Brand.mute}
                style={{ fontWeight: tab === t ? '700' : '500', textTransform: 'capitalize' }}>
                {t}
              </Txt>
            </Pressable>
          ))}
        </View>

        {tab === 'stats' && (
          <View style={styles.statGrid}>
            <StatCard label="All-time P&L" value={`${totalPnl >= 0 ? '+' : ''}${fmtUsd(totalPnl)}`} color={totalPnl >= 0 ? Brand.green : Brand.red} />
            <StatCard label="ROI" value={`${roi >= 0 ? '+' : ''}${roi.toFixed(0)}%`} color={roi >= 0 ? Brand.green : Brand.red} />
            <StatCard label="Win rate" value={winRate == null ? '—' : `${winRate}%`} />
            <StatCard label="Volume" value={balance ? fmtUsd(balance.totalVolume) : '—'} />
          </View>
        )}
        {tab === 'bets' && (
          <View style={styles.emptyTab}>
            <Txt variant="label" color={Brand.mute}>
              {trades.length ? `${trades.length} settled bets` : 'No settled bets yet.'}
            </Txt>
          </View>
        )}
        {tab === 'badges' && (
          <View style={styles.emptyTab}>
            <Txt variant="label" color={Brand.mute}>
              Badges are coming soon.
            </Txt>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  content: { paddingHorizontal: 16, paddingBottom: 120, gap: 20 },
  header: { paddingTop: 12, gap: 10 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#e8b84b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: '#18f7ff',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingsBtn: {
    backgroundColor: Brand.cta,
    borderRadius: Radii.pill,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  claimBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Brand.card,
    borderRadius: Radii.card,
    borderWidth: 1,
    borderColor: 'rgba(45,190,78,0.3)',
    padding: 14,
  },
  perfCard: {
    backgroundColor: Brand.card,
    borderRadius: Radii.card,
    padding: 16,
  },
  perfTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  section: { gap: 10 },
  posList: {
    backgroundColor: Brand.card,
    borderRadius: Radii.card,
    overflow: 'hidden',
  },
  posRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  posFlag: { width: 32, height: 32, borderRadius: 16 },
  tabs: { flexDirection: 'row', gap: 20 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: Brand.card,
    borderRadius: Radii.card,
    padding: 16,
    gap: 6,
  },
  emptyTab: { paddingVertical: 32, alignItems: 'center' },
});
