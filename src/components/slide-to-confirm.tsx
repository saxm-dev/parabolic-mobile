import { useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Txt } from '@/components/txt';
import { Brand } from '@/constants/theme';

const THUMB = 56;
const PAD = 4;

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
  const [done, setDone] = useState(false);
  const x = useRef(new Animated.Value(0)).current;
  const confirmed = useRef(false);

  const maxXRef = useRef(0);
  maxXRef.current = Math.max(0, trackW - THUMB - PAD * 2);
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  const pan = useRef(
    PanResponder.create({
      // Claim the gesture immediately so nothing above (scroll / nav) can steal it.
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => {
        if (confirmed.current) return;
        x.setValue(Math.max(0, Math.min(maxXRef.current, g.dx)));
      },
      onPanResponderRelease: (_e, g) => {
        const max = maxXRef.current;
        if (g.dx >= max * 0.8 && !confirmed.current && max > 0) {
          confirmed.current = true;
          setDone(true);
          Animated.timing(x, { toValue: max, duration: 90, useNativeDriver: true }).start(() =>
            onConfirmRef.current(),
          );
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width);

  return (
    <View style={[styles.track, disabled && { opacity: 0.4 }]} onLayout={onLayout}>
      <Txt variant="title" color={Brand.dim} center style={styles.label}>
        {done ? 'Confirming…' : label}
      </Txt>
      <Animated.View
        style={[styles.thumb, { transform: [{ translateX: x }] }]}
        {...pan.panHandlers}>
        <Txt variant="score" color={Brand.ctaText}>
          ›
        </Txt>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: THUMB + PAD * 2,
    borderRadius: (THUMB + PAD * 2) / 2,
    backgroundColor: Brand.surface,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: { fontSize: 16 },
  thumb: {
    position: 'absolute',
    left: PAD,
    top: PAD,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: Brand.cta,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
