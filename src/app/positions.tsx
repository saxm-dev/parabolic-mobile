import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';

export default function PositionsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <ThemedText type="subtitle" style={{ color: Brand.white, fontSize: 24, lineHeight: 32 }}>
          Positions
        </ThemedText>
      </View>
      <View style={styles.emptyWrap}>
        <ThemedText style={{ color: Brand.dim, textAlign: 'center' }}>
          Sign in to see your open positions.
        </ThemedText>
        <ThemedText type="small" style={{ color: Brand.mute, textAlign: 'center' }}>
          Accounts and trading arrive in the next build.
        </ThemedText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  header: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
});
