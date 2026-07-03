import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { Brand, Radii } from '@/constants/theme';

// Minimal shape of what we use from the tab bar props — avoids the
// expo-router vs @react-navigation duplicate-types clash.
type NavProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    navigate: (name: string) => void;
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: boolean }) => {
      defaultPrevented: boolean;
    };
  };
};

const PILL_ROUTES: { name: string; icon: IconName }[] = [
  { name: 'index', icon: 'navHome' },
  { name: 'positions', icon: 'navTrades' },
  { name: 'leaderboard', icon: 'navLeaders' },
  { name: 'profile', icon: 'navProfile' },
];

/**
 * Custom floating tab bar from the Figma design (63:2554): a translucent
 * 4-icon glass pill + a detached search circle, over a bottom fade.
 */
export function BottomNav({ state, navigation }: NavProps) {
  const insets = useSafeAreaInsets();
  const currentName = state.routes[state.index]?.name;

  const go = (name: string) => {
    const target = state.routes.find((r) => r.name === name);
    if (!target) return;
    const focused = currentName === name;
    const event = navigation.emit({ type: 'tabPress', target: target.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(name);
  };

  return (
    <LinearGradient
      colors={['rgba(7,7,7,0)', Brand.bg]}
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}
      pointerEvents="box-none">
      <View style={styles.row}>
        <View style={styles.pill}>
          {PILL_ROUTES.map((r) => {
            const active = currentName === r.name;
            return (
              <Pressable key={r.name} onPress={() => go(r.name)} style={styles.item}>
                <View style={[styles.itemInner, active && styles.itemActive]}>
                  <Icon name={r.icon} size={28} opacity={active ? 1 : 0.6} />
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={() => go('search')} style={styles.searchPill}>
          <View style={styles.searchInner}>
            <Icon name="navSearch" size={26} opacity={currentName === 'search' ? 1 : 0.6} />
          </View>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: {
    flex: 1,
    flexDirection: 'row',
    height: 64,
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.round,
    backgroundColor: Brand.navGlass,
    borderWidth: 1,
    borderColor: Brand.hair05,
  },
  item: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center' },
  itemInner: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 64,
  },
  itemActive: { backgroundColor: Brand.activeItem },
  searchPill: {
    padding: 7,
    borderRadius: Radii.round,
    backgroundColor: Brand.navGlass,
    borderWidth: 1,
    borderColor: Brand.hair05,
  },
  searchInner: { padding: 12, borderRadius: Radii.round },
});
