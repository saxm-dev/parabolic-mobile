import { useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';

const THUMB = 56;

/** Drag the thumb to the end to fire onConfirm (Figma review screen). */
export function SlideToConfirm({
  label,
  onConfirm,
  disabled,
}: {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [trackW, setTrackW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const confirmed = useRef(false);

  const maxX = Math.max(0, trackW - THUMB - 8);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderMove: (_e, g) => {
        const v = Math.max(0, Math.min(maxXRef.current, g.dx));
        x.setValue(v);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dx >= maxXRef.current * 0.92 && !confirmed.current) {
          confirmed.current = true;
          Animated.timing(x, { toValue: maxXRef.current, duration: 80, useNativeDriver: false }).start(
            () => onConfirmRef.current(),
          );
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
        }
      },
    }),
  ).current;

  // Keep latest values reachable from the stable PanResponder.
  const maxXRef = useRef(maxX);
  maxXRef.current = maxX;
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  const onLayout = (e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width);

  return (
    <View style={[styles.track, disabled && { opacity: 0.4 }]} onLayout={onLayout}>
      <ThemedText type="smallBold" style={styles.label}>
        {label}
      </ThemedText>
      <Animated.View style={[styles.thumb, { transform: [{ translateX: x }] }]} {...pan.panHandlers} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: THUMB + 8,
    borderRadius: (THUMB + 8) / 2,
    backgroundColor: Brand.surface,
    justifyContent: 'center',
  },
  label: { color: Brand.dim, textAlign: 'center', fontSize: 16 },
  thumb: {
    position: 'absolute',
    left: 4,
    top: 4,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: Brand.cta,
  },
});
