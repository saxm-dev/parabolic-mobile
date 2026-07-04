import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Platform, View } from 'react-native';

/** SF Symbol (iOS) with a sized spacer fallback on web/Android so layout holds. */
export function Sym({
  name,
  size = 20,
  color = '#fff',
}: {
  name: SymbolViewProps['name'];
  size?: number;
  color?: string;
}) {
  if (Platform.OS !== 'ios') return <View style={{ width: size, height: size }} />;
  return <SymbolView name={name} size={size} tintColor={color} resizeMode="scaleAspectFit" />;
}
