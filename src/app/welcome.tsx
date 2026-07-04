import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { F } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { markWelcomeSeen } from '@/lib/auth';

/** Tiled "WIN" backdrop + one big lime WIN (Text, not SVG — Expo Go safe). */
function WinPattern({ width, height }: { width: number; height: number }) {
  const rows = Math.ceil(height / 100);
  const cols = Math.ceil(width / 180) + 1;
  const tiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push(
        <Text
          key={`${r}-${c}`}
          style={[
            styles.tile,
            { left: c * 180 - (r % 2 ? 90 : 0), top: r * 100 },
          ]}>
          WIN
        </Text>,
      );
    }
  }
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {tiles}
      <View style={styles.bigWinWrap}>
        <Text style={[styles.bigWin, { fontSize: Math.min(160, width * 0.44) }]}>WIN</Text>
      </View>
    </View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const done = async (dest: 'home' | 'signup' | 'login') => {
    await markWelcomeSeen();
    if (dest === 'home') router.replace('/');
    else router.push(dest === 'signup' ? '/auth/signup' : '/auth/login');
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.card}>
          <WinPattern width={width - Spacing.three * 2} height={height * 0.78} />
          <View style={styles.cardTop}>
            <ThemedText style={styles.wordmark}>parabolic</ThemedText>
            <Pressable onPress={() => done('home')} style={styles.skipPill} hitSlop={8}>
              <ThemedText type="smallBold" style={{ color: Brand.white }}>
                Skip
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.taglineWrap}>
            <ThemedText style={styles.tagline}>
              Trade{'  '}
              <View style={styles.livePill}>
                <ThemedText type="smallBold" style={styles.livePillText}>
                  • LIVE
                </ThemedText>
              </View>
              {'  '}on every{'\n'}game as it happens
            </ThemedText>
          </View>
        </View>

        <View style={styles.ctas}>
          <Pressable onPress={() => done('signup')} style={styles.primaryBtn}>
            <ThemedText style={styles.primaryBtnText}>Create account</ThemedText>
          </Pressable>
          <Pressable onPress={() => done('login')} style={styles.secondaryBtn}>
            <ThemedText style={styles.secondaryBtnText}>Log in</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  tile: {
    position: 'absolute',
    fontFamily: F.bold,
    fontSize: 68,
    fontWeight: '800',
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.05)',
  },
  bigWinWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigWin: { fontFamily: F.bold, fontWeight: '800', letterSpacing: 4, color: Brand.lime, opacity: 0.92 },
  safe: { flex: 1, paddingHorizontal: Spacing.three, gap: Spacing.three },
  card: {
    flex: 1,
    backgroundColor: '#101208',
    borderRadius: 28,
    overflow: 'hidden',
    padding: Spacing.three,
    justifyContent: 'space-between',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wordmark: { color: Brand.white, fontSize: 22, lineHeight: 30, fontWeight: '700' },
  skipPill: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  taglineWrap: { alignItems: 'center', paddingBottom: Spacing.four },
  tagline: {
    color: Brand.white,
    fontSize: 28,
    lineHeight: 38,
    fontWeight: '700',
    textAlign: 'center',
  },
  livePill: {
    backgroundColor: Brand.red,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
    transform: [{ translateY: 4 }],
  },
  livePillText: { color: '#fff', fontSize: 16, lineHeight: 24 },
  ctas: { gap: Spacing.two },
  primaryBtn: {
    backgroundColor: Brand.cta,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: Brand.ctaText, fontSize: 17, lineHeight: 24, fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryBtnText: { color: Brand.white, fontSize: 17, lineHeight: 24, fontWeight: '600' },
});
