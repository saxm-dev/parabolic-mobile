/**
 * Parabolic mobile design tokens — extracted from Figma "Visual Exploration 03"
 * via the Dev Mode MCP (node data, not eyeballed). Source of truth for the
 * fidelity rebuild. Values are the real ones from the Home frame (63:2319).
 */

import '@/global.css';

import { Platform } from 'react-native';

/** Inter font families (loaded via @expo-google-fonts/inter in the root layout). */
export const F = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Real palette from the mobile design (differs from the web app). */
export const Brand = {
  // Surfaces
  bg: '#070707', // screen / nav fade target
  card: '#141414', // live game-card base (rgb 20,20,20)
  cardNeutral: '#1a1a1a', // open-bet / non-live card
  surface: '#191919', // selected chip / raised
  chip: 'transparent', // unselected chip has no fill

  // Glass / translucent
  navGlass: 'rgba(33,33,33,0.8)',
  activeItem: 'rgba(255,255,255,0.08)', // active nav pill, "FROM N BETS" pill
  balanceGlass: 'rgba(255,255,255,0.07)',
  pctPillBg: 'rgba(228,228,228,0.08)', // "+24.6%" pill

  // Hairlines / borders
  hair02: 'rgba(255,255,255,0.02)',
  hair03: 'rgba(255,255,255,0.03)',
  hair05: 'rgba(255,255,255,0.05)',
  hair17: 'rgba(255,255,255,0.17)',

  // Text
  white: '#ffffff',
  offWhite: '#f6f6f6',
  dim: '#b5b5b5',
  pctPillText: '#cfcfcf',
  mute: '#7a7a7a',

  // Accents
  green: '#2cbe4e', // positive / LIVE pill
  greenBorder: '#8dff7e', // live game-card border + glow
  lime: '#ebff76', // away-team win %
  blue: '#8dc4e8', // home-team win %
  red: '#ff5247', // negative (kept from web; refine when a red appears in design)

  // Back-compat aliases used by not-yet-rebuilt screens
  primary: '#2cbe4e',
  primaryLight: '#8dff7e',
  greenLight: '#8dff7e',
  cyan: '#8dc4e8',
  ice: '#8dc4e8',
  border: 'rgba(255,255,255,0.05)',
  border2: 'rgba(255,255,255,0.03)',
  sideHome: '#8dc4e8',
  sideAway: '#ebff76',
  drawGrey: '#b5b5b5',
  cta: '#ffffff',
  ctaText: '#0b0d11',
  livePill: '#2cbe4e',
} as const;

/** Typography presets — {fontFamily, fontSize, lineHeight, letterSpacing}. */
export const Type = {
  /** Greeting lines, "2 open bets" — Inter Display SemiBold 22/20 */
  display: { fontFamily: F.semibold, fontSize: 22, lineHeight: 22, letterSpacing: -0.22 },
  /** Scoreboard numbers — Inter Display SemiBold 24/26 */
  score: { fontFamily: F.semibold, fontSize: 24, lineHeight: 26, letterSpacing: -0.24 },
  /** Match title — Inter Medium 15/20 */
  title: { fontFamily: F.medium, fontSize: 15, lineHeight: 20, letterSpacing: 0 },
  /** Chip labels — Inter Medium 14/20 */
  body: { fontFamily: F.medium, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  /** Team abbrev / open-bet name — Inter Medium 13/16 */
  label: { fontFamily: F.medium, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  /** Leading win % — Inter SemiBold 13/20 */
  pct: { fontFamily: F.semibold, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  /** Balance amount — Inter SemiBold 12/20 */
  balance: { fontFamily: F.semibold, fontSize: 12, lineHeight: 20, letterSpacing: 0 },
  /** League label / LIVE — Inter SemiBold 10/16 +0.3 uppercase */
  caps: { fontFamily: F.semibold, fontSize: 10, lineHeight: 16, letterSpacing: 0.3 },
  /** "FROM N BETS" — Inter SemiBold 12/15 +0.36 uppercase */
  capsLg: { fontFamily: F.semibold, fontSize: 12, lineHeight: 15, letterSpacing: 0.36 },
  /** Game clock — Inter Medium 12/16 */
  time: { fontFamily: F.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  /** Open-bet P&L $ — Inter Medium 14/16 */
  pnl: { fontFamily: F.medium, fontSize: 14, lineHeight: 16, letterSpacing: 0 },
  /** "+24.6%" pill — Inter SemiBold 12/20 */
  pctPill: { fontFamily: F.semibold, fontSize: 12, lineHeight: 20, letterSpacing: 0 },
} as const;

export const Radii = {
  sm: 6,
  md: 8,
  card: 16,
  chip: 24,
  pill: 99,
  round: 999,
} as const;

// ── Back-compat exports (existing screens import these) ─────────────────────
export const Colors = {
  light: {
    text: Brand.white,
    background: Brand.bg,
    backgroundElement: Brand.card,
    backgroundSelected: Brand.surface,
    textSecondary: Brand.dim,
  },
  dark: {
    text: Brand.white,
    background: Brand.bg,
    backgroundElement: Brand.card,
    backgroundSelected: Brand.surface,
    textSecondary: Brand.dim,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: { sans: F.medium, serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: F.medium, serif: 'serif', rounded: F.medium, mono: 'monospace' },
  web: { sans: F.medium, serif: 'serif', rounded: F.medium, mono: 'monospace' },
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
