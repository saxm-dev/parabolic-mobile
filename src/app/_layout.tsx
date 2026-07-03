import { DarkTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { Brand } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

// Dark-only: carbon surfaces + mint accent, regardless of system scheme.
const ParabolicTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Brand.primary,
    background: Brand.bg,
    card: Brand.card,
    text: Brand.white,
    border: Brand.border,
    notification: Brand.red,
  },
};

export default function TabLayout() {
  return (
    <ThemeProvider value={ParabolicTheme}>
      <StatusBar style="light" />
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
