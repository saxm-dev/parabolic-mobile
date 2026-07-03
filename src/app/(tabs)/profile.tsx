import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <ThemedText type="subtitle" style={{ color: Brand.white, fontSize: 24, lineHeight: 32 }}>
          Profile
        </ThemedText>
      </View>
      <View style={styles.emptyWrap}>
        <ThemedText style={{ color: Brand.dim, textAlign: 'center' }}>
          Sign in or create an account to track your stats.
        </ThemedText>
        <ThemedText type="small" style={{ color: Brand.mute, textAlign: 'center' }}>
          Login, points and streaks arrive in the next build.
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
