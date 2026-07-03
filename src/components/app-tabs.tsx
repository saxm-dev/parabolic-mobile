import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Brand } from '@/constants/theme';

// 5-target bar per the Figma design (Home / Trades / Leaderboard / Profile /
// Search). On iOS 26 NativeTabs render with the system liquid-glass material.
export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={Brand.card}
      indicatorColor={Brand.surface}
      iconColor={{ default: Brand.mute, selected: Brand.primary }}
      labelStyle={{ color: Brand.mute, selected: { color: Brand.primary } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="soccerball" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="positions">
        <NativeTabs.Trigger.Label>Trades</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="arrow.left.arrow.right" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="leaderboard">
        <NativeTabs.Trigger.Label>Leaders</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="trophy.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search" role="search">
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
