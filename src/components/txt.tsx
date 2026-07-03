import { Text, type TextProps, type TextStyle } from 'react-native';

import { Brand, Type } from '@/constants/theme';

type Variant = keyof typeof Type;

export type TxtProps = TextProps & {
  variant?: Variant;
  color?: string;
  upper?: boolean;
  center?: boolean;
  o?: number; // opacity
};

/** Typed text using the extracted Figma type ramp. */
export function Txt({
  variant = 'body',
  color = Brand.white,
  upper,
  center,
  o,
  style,
  ...rest
}: TxtProps) {
  const preset = Type[variant] as TextStyle;
  return (
    <Text
      style={[
        preset,
        { color },
        upper && { textTransform: 'uppercase' },
        center && { textAlign: 'center' },
        o != null && { opacity: o },
        style,
      ]}
      {...rest}
    />
  );
}
