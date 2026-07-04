import { useRouter } from 'expo-router';
import { SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Sym } from '@/components/sym';
import { Txt } from '@/components/txt';
import { Brand, Radii } from '@/constants/theme';
import { useIdentity } from '@/hooks/use-identity';
import { logout } from '@/lib/auth';

type SFName = SymbolViewProps['name'];

const SECTION_LABEL = '#949494';
const VALUE = '#afafaf';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Txt variant="body" color={SECTION_LABEL} style={styles.sectionLabel}>
        {title}
      </Txt>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  chevron,
  toggle,
  danger,
  onPress,
  last,
}: {
  icon: SFName;
  label: string;
  value?: string;
  chevron?: boolean;
  toggle?: boolean;
  danger?: boolean;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed && { opacity: 0.6 }]}>
      <Sym name={icon} size={20} color={danger ? Brand.red : '#e6e6e6'} />
      <Txt variant="title" color={danger ? Brand.red : Brand.white} style={styles.rowLabel}>
        {label}
      </Txt>
      {value != null && (
        <Txt variant="body" color={VALUE}>
          {value}
        </Txt>
      )}
      {chevron && <Sym name="chevron.right" size={16} color={VALUE} />}
      {toggle != null && <Toggle on={toggle} />}
    </Pressable>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <View style={[styles.toggle, { backgroundColor: on ? '#01a32b' : '#2f2f2f' }]}>
      <View style={[styles.knob, on ? { right: 2 } : { left: 2 }]} />
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const id = useIdentity();
  const [notifications, setNotifications] = useState(true);

  const soon = () => {};

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn} hitSlop={8}>
          <Sym name="xmark" size={16} color={Brand.white} />
        </Pressable>
        <Txt variant="title" color={Brand.white} style={{ fontWeight: '600' }}>
          Settings
        </Txt>
        <View style={styles.closeBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Sym name="person.fill" size={34} color="#0c0c0c" />
          </View>
          <Txt variant="display" color={Brand.white}>
            {id.auth?.username ?? 'Guest'}
          </Txt>
          <Pressable style={styles.editBtn} onPress={soon}>
            <Txt variant="caps" color={Brand.white} upper>
              Edit
            </Txt>
          </Pressable>
        </View>

        <Section title="Account">
          <Row icon="person.text.rectangle" label="Account details" chevron onPress={soon} />
          <Row icon="creditcard" label="Payment & deposits" chevron onPress={soon} />
          <Row icon="chart.line.downtrend.xyaxis" label="Deposit limit" chevron onPress={soon} last />
        </Section>

        <Section title="Security & Notifications">
          <Row icon="faceid" label="Face ID" value="Off" chevron onPress={soon} />
          <Row icon="lock" label="Profile privacy" value="Public" chevron onPress={soon} />
          <Row
            icon="bell"
            label="Notifications"
            toggle={notifications}
            onPress={() => setNotifications((v) => !v)}
            last
          />
        </Section>

        <Section title="Preferences">
          <Row icon="globe" label="Language" chevron onPress={soon} />
          <Row icon="dollarsign.circle" label="Currency" chevron onPress={soon} />
          <Row icon="app.badge" label="App Icon" chevron onPress={soon} last />
        </Section>

        <Section title="About">
          <Row icon="info.circle" label="About Parabolic" chevron onPress={soon} />
          <Row icon="questionmark.circle" label="Help & Support" chevron onPress={soon} />
          <Row icon="person.2" label="Invite your friends" chevron onPress={soon} />
          <Row
            icon="at"
            label="Follow on X"
            chevron
            onPress={() => Linking.openURL('https://x.com/betparabolic')}
            last
          />
        </Section>

        {id.auth && (
          <Section title="">
            <Row
              icon="rectangle.portrait.and.arrow.right"
              label="Log out"
              danger
              onPress={() => {
                logout();
                router.back();
              }}
              last
            />
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 60,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 24 },
  identity: { alignItems: 'center', gap: 10, paddingTop: 12 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e8b84b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtn: {
    backgroundColor: Brand.surface,
    borderRadius: Radii.pill,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  section: { gap: 8 },
  sectionLabel: { paddingHorizontal: 4, fontWeight: '500' },
  card: { backgroundColor: Brand.card, borderRadius: Radii.card, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  rowLabel: { flex: 1 },
  toggle: {
    width: 34,
    height: 22,
    borderRadius: 6,
    justifyContent: 'center',
  },
  knob: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: '#e6e6e6',
  },
});
