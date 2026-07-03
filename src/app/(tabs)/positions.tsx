import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BottomTabInset, Brand, Spacing } from '@/constants/theme';
import { useAccount } from '@/hooks/use-account';
import { fetchGames, type Game, type Position } from '@/lib/api';

function fmtUsd(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function BetRow({
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
    <Pressable onPress={onPress} style={styles.row}>
      {team && <Image source={{ uri: team.logo }} style={styles.flag} contentFit="contain" />}
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText numberOfLines={1} style={{ color: Brand.white, fontWeight: '600' }}>
          {team?.name ?? pos.side.toUpperCase()}
        </ThemedText>
        <ThemedText type="small" style={{ color: Brand.mute }}>
          {fmtUsd(pos.margin)} · {pos.leverage}x · in at {Math.round(pos.entryPx * 100)}%
        </ThemedText>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <ThemedText type="smallBold" style={{ color: up ? Brand.primary : Brand.red, fontSize: 16 }}>
          {up ? '+' : ''}
          {fmtUsd(pos.pnl)}
        </ThemedText>
        <ThemedText type="small" style={{ color: up ? Brand.primary : Brand.red }}>
          {up ? '+' : ''}
          {pos.roe.toFixed(1)}%
        </ThemedText>
      </View>
    </Pressable>
  );
}

export default function TradesScreen() {
  const router = useRouter();
  const { positions, refresh } = useAccount(10_000);
  const [games, setGames] = useState<Game[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadGames = useCallback(async () => {
    try {
      setGames(await fetchGames());
    } catch {}
  }, []);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), loadGames()]);
    setRefreshing(false);
  }, [refresh, loadGames]);

  const gameById = new Map(games.map((g) => [g.id, g]));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <ThemedText type="subtitle" style={{ color: Brand.white, fontSize: 24, lineHeight: 32 }}>
          Trades
        </ThemedText>
      </View>
      <FlatList
        data={positions}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <BetRow
            pos={item}
            game={gameById.get(item.gameId)}
            onPress={() => router.push(`/game/${item.gameId}`)}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <ThemedText style={{ color: Brand.dim, textAlign: 'center' }}>
              No open bets yet.
            </ThemedText>
            <ThemedText type="small" style={{ color: Brand.mute, textAlign: 'center' }}>
              Pick a live market on Home to get started.
            </ThemedText>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  header: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
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
    borderRadius: 16,
    padding: Spacing.three,
  },
  flag: { width: 32, height: 32, borderRadius: 16 },
  emptyWrap: { alignItems: 'center', gap: Spacing.one, marginTop: Spacing.six },
});
