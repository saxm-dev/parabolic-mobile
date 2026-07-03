import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useIdentity } from '@/hooks/use-identity';
import { logout } from '@/lib/auth';

export default function ProfileScreen() {
  const router = useRouter();
  const id = useIdentity();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <ThemedText type="subtitle" style={{ color: Brand.white, fontSize: 24, lineHeight: 32 }}>
          Profile
        </ThemedText>
      </View>

      {id.auth ? (
        <View style={styles.body}>
          <View style={styles.card}>
            <ThemedText style={styles.username}>{id.auth.username}</ThemedText>
            <ThemedText type="small" style={{ color: Brand.mute }}>
              Signed in
            </ThemedText>
          </View>
          <Pressable style={styles.secondaryBtn} onPress={() => logout()}>
            <ThemedText style={{ color: Brand.red, fontWeight: '600' }}>Log out</ThemedText>
          </Pressable>
          <ThemedText type="small" style={styles.note}>
            Stats, bets and settings land here in the next build.
          </ThemedText>
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.card}>
            <ThemedText style={styles.username}>Guest</ThemedText>
            <ThemedText type="small" style={{ color: Brand.mute }}>
              Trading with the guest balance on this device. Create an account to keep it.
            </ThemedText>
          </View>
          <Pressable style={styles.primaryBtn} onPress={() => router.push('/auth/signup')}>
            <ThemedText style={{ color: Brand.ctaText, fontWeight: '700', fontSize: 17 }}>
              Create account
            </ThemedText>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => router.push('/auth/login')}>
            <ThemedText style={{ color: Brand.white, fontWeight: '600' }}>Log in</ThemedText>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  header: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  body: { paddingHorizontal: Spacing.three, gap: Spacing.two },
  card: {
    backgroundColor: Brand.card,
    borderColor: Brand.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    gap: 4,
  },
  username: { color: Brand.white, fontSize: 20, lineHeight: 28, fontWeight: '700' },
  primaryBtn: {
    backgroundColor: Brand.cta,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryBtn: {
    backgroundColor: Brand.surface,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  note: { color: Brand.mute, textAlign: 'center', marginTop: Spacing.two },
});
