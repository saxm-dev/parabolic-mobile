import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import * as icons from '@/assets/figma-icons';

export type IconName = keyof typeof icons;

/** Renders a Figma-exported SVG icon at a given size/opacity. */
export function Icon({ name, size, opacity = 1 }: { name: IconName; size: number; opacity?: number }) {
  const xml = icons[name];
  if (!xml) return <View style={{ width: size, height: size }} />;
  return (
    <View style={{ width: size, height: size, opacity }}>
      <SvgXml xml={xml} width={size} height={size} />
    </View>
  );
}
