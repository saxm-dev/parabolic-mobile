import { Redirect } from 'expo-router';

import AppTabs from '@/components/app-tabs';
import { useIdentity } from '@/hooks/use-identity';

export default function TabLayout() {
  const id = useIdentity();
  if (!id.ready) return null; // splash overlay is still up
  if (!id.seenWelcome) return <Redirect href="/welcome" />;
  return <AppTabs />;
}
