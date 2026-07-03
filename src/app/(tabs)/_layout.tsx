import { Redirect, Tabs } from 'expo-router';

import { BottomNav } from '@/components/bottom-nav';
import { useIdentity } from '@/hooks/use-identity';

export default function TabLayout() {
  const id = useIdentity();
  if (!id.ready) return null; // splash overlay is still up
  if (!id.seenWelcome) return <Redirect href="/welcome" />;

  return (
    <Tabs
      tabBar={(props: any) => <BottomNav {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: '#070707' } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="positions" />
      <Tabs.Screen name="leaderboard" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="search" />
    </Tabs>
  );
}
