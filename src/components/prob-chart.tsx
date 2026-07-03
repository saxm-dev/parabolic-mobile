import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import type { HistoryPoint } from '@/lib/api';

const HEIGHT = 200;
const PAD_Y = 14;

function pathFor(points: { x: number; y: number }[]): string {
  if (!points.length) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

/**
 * Dual-line win-probability chart (home + away = 1 - home), styled after the
 * Figma game-details chart: thin lines, floating % pills on the right edge.
 */
export function ProbChart({
  history,
  homeAbbr,
  awayAbbr,
}: {
  history: HistoryPoint[];
  homeAbbr: string;
  awayAbbr: string;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const pts = history.filter((h) => h.mp > 0 && h.mp < 1);
  const chartW = Math.max(0, width - 86); // reserve space for the % pills
  const hasData = pts.length >= 2 && chartW > 0;

  let homePath = '';
  let awayPath = '';
  let homeY = HEIGHT / 2;
  let awayY = HEIGHT / 2;
  let homePct: number | null = null;

  if (hasData) {
    const t0 = pts[0].t;
    const t1 = pts[pts.length - 1].t;
    const span = Math.max(1, t1 - t0);
    const yFor = (p: number) => PAD_Y + (1 - p) * (HEIGHT - PAD_Y * 2);
    const homePts = pts.map((h) => ({ x: ((h.t - t0) / span) * chartW, y: yFor(h.mp) }));
    const awayPts = pts.map((h) => ({ x: ((h.t - t0) / span) * chartW, y: yFor(1 - h.mp) }));
    homePath = pathFor(homePts);
    awayPath = pathFor(awayPts);
    homeY = homePts[homePts.length - 1].y;
    awayY = awayPts[awayPts.length - 1].y;
    homePct = Math.round(pts[pts.length - 1].mp * 100);
  }

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {hasData ? (
        <>
          <Svg width={width} height={HEIGHT}>
            <Line
              x1={0}
              y1={HEIGHT / 2}
              x2={chartW}
              y2={HEIGHT / 2}
              stroke={Brand.border2}
              strokeWidth={1}
              strokeDasharray="3 5"
            />
            <Path d={awayPath} stroke={Brand.sideAway} strokeWidth={2} fill="none" />
            <Path d={homePath} stroke={Brand.sideHome} strokeWidth={2} fill="none" />
          </Svg>
          <View
            style={[
              styles.pill,
              { top: clampPill(homeY), backgroundColor: 'rgba(124,192,244,0.16)' },
            ]}>
            <ThemedText type="smallBold" style={{ color: Brand.sideHome, fontSize: 12, lineHeight: 16 }}>
              {homeAbbr} {homePct}%
            </ThemedText>
          </View>
          <View
            style={[
              styles.pill,
              { top: clampPill(awayY), backgroundColor: 'rgba(233,167,247,0.16)' },
            ]}>
            <ThemedText type="smallBold" style={{ color: Brand.sideAway, fontSize: 12, lineHeight: 16 }}>
              {awayAbbr} {homePct == null ? '' : 100 - homePct}%
            </ThemedText>
          </View>
        </>
      ) : (
        <View style={styles.emptyWrap}>
          <ThemedText type="small" style={{ color: Brand.mute }}>
            Price history appears once the market opens
          </ThemedText>
        </View>
      )}
    </View>
  );
}

function clampPill(y: number): number {
  return Math.min(HEIGHT - 26, Math.max(2, y - 12));
}

const styles = StyleSheet.create({
  wrap: { height: HEIGHT, justifyContent: 'center' },
  pill: {
    position: 'absolute',
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  emptyWrap: { alignItems: 'center' },
});
