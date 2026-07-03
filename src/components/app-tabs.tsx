import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Brand } from '@/constants/theme';

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={Brand.card}
      indicatorColor={Brand.surface}
      iconColor={{ default: Brand.mute, selected: Brand.primary }}
      labelStyle={{ color: Brand.mute, selected: { color: Brand.primary } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Markets</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="sportscourt.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="positions">
        <NativeTabs.Trigger.Label>Positions</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.line.uptrend.xyaxis" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="leaderboard">
        <NativeTabs.Trigger.Label>Leaderboard</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="trophy.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle.fill" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
