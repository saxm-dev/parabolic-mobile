/**
 * Parabolic brand theme — mirrors the web app's src/lib/theme.js (B palette).
 * The app is dark-only: light and dark resolve to the same carbon palette.
 */

import '@/global.css';

import { Platform } from 'react-native';

/** Parabolic brand palette (carbon surfaces + mint accent). */
export const Brand = {
  primary: '#1fd182',
  primaryLight: '#52e0a3',
  green: '#1fd182',
  greenLight: '#52e0a3',
  red: '#ff5247',
  cyan: '#00d4ff',
  ice: '#5ce1ff',
  blue: '#0088cc',
  white: '#eef1f6',
  dim: '#949aa6',
  mute: '#5e636e',
  bg: '#06070a',
  card: '#0b0d11',
  surface: '#11141a',
  border: '#181b22',
  border2: '#1f2329',
} as const;

const carbon = {
  text: Brand.white,
  background: Brand.bg,
  backgroundElement: Brand.card,
  backgroundSelected: Brand.surface,
  textSecondary: Brand.dim,
};

export const Colors = {
  light: carbon,
  dark: carbon,
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
