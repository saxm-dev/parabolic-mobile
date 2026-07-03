import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Brand, Spacing } from '@/constants/theme';
import { fetchLeaderboard, type LeaderboardEntry } from '@/lib/api';

function fmtUsd(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function Row({ entry }: { entry: LeaderboardEntry }) {
  const up = entry.returnPct >= 0;
  return (
    <View style={styles.row}>
      <ThemedText type="smallBold" style={styles.rank}>
        {entry.rank}
      </ThemedText>
      <View style={styles.nameCol}>
        <ThemedText numberOfLines={1} style={{ color: Brand.white }}>
          {entry.username ?? `anon-${entry.userId.slice(0, 6)}`}
        </ThemedText>
        <ThemedText type="small" style={{ color: Brand.mute }}>
          {entry.points.toLocaleString()} pts · {entry.tradeCount} trades
        </ThemedText>
      </View>
      <View style={styles.pnlCol}>
        <ThemedText type="smallBold" style={{ color: up ? Brand.primary : Brand.red }}>
          {up ? '+' : ''}
          {entry.returnPct.toFixed(1)}%
        </ThemedText>
        <ThemedText type="small" style={{ color: up ? Brand.primary : Brand.red }}>
          {fmtUsd(entry.closedPnl)}
        </ThemedText>
      </View>
    </View>
  );
}

export default function LeaderboardScreen() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setEntries(await fetchLeaderboard('points'));
      setError(null);
    } catch {
      setError('Unable to load leaderboard. Pull to retry.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <ThemedText type="subtitle" style={{ color: Brand.white, fontSize: 24, lineHeight: 32 }}>
          Leaderboard
        </ThemedText>
      </View>
      {error && (
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
      )}
      <FlatList
        data={entries}
        keyExtractor={(e) => e.userId}
        renderItem={({ item }) => <Row entry={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  header: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  error: { color: Brand.red, paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Brand.card,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rank: { color: Brand.dim, width: 28 },
  nameCol: { flex: 1 },
  pnlCol: { alignItems: 'flex-end' },
});
