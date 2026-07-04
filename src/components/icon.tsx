import { Image } from 'expo-image';

// PNG rasters (via expo-image) instead of SVG — react-native-svg does not
// render inside Expo Go on this SDK; Image works in both Expo Go and dev builds.
const ICONS = {
  navHome: require('../../assets/figma/navHome.png'),
  navTrades: require('../../assets/figma/navTrades.png'),
  navLeaders: require('../../assets/figma/navLeaders.png'),
  navProfile: require('../../assets/figma/navProfile.png'),
  navSearch: require('../../assets/figma/navSearch.png'),
  chipFootball: require('../../assets/figma/chipFootball.png'),
  chipSoccer: require('../../assets/figma/chipSoccer.png'),
  chipBasketball: require('../../assets/figma/chipBasketball.png'),
  chipMma: require('../../assets/figma/chipMma.png'),
} as const;

export type IconName = keyof typeof ICONS;

/** Renders a Figma-exported icon (PNG) at a given size/opacity. */
export function Icon({ name, size, opacity = 1 }: { name: IconName; size: number; opacity?: number }) {
  const src = ICONS[name];
  if (!src) return null;
  return (
    <Image source={src} style={{ width: size, height: size, opacity }} contentFit="contain" />
  );
}
