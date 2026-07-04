import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Brand, F } from '@/constants/theme';
import type { HistoryPoint, Position } from '@/lib/api';

const HEIGHT = 230;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;
const PAD_LEFT = 6;
const PAD_RIGHT = 54; // room for % pills / y labels
const MIN_SPAN_MS = 30_000;

type Vp = { start: number; end: number };

function line(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

/** Interactive win-probability chart: dual lines, position lines, axes, pinch/pan. */
export function ProbChart({
  history,
  homeAbbr,
  awayAbbr,
  position,
  windowMs,
}: {
  history: HistoryPoint[];
  homeAbbr: string;
  awayAbbr: string;
  position?: Position | null;
  windowMs?: number | null;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const pts = useMemo(() => history.filter((h) => h.mp > 0 && h.mp < 1), [history]);
  const dataMin = pts.length ? pts[0].t : 0;
  const dataMax = pts.length ? pts[pts.length - 1].t : 1;
  const fullSpan = Math.max(1, dataMax - dataMin);

  // Viewport (visible time window). Reset when the timeframe chip changes.
  const [vp, setVp] = useState<Vp>({ start: dataMin, end: dataMax });
  useEffect(() => {
    const span = windowMs && windowMs < fullSpan ? windowMs : fullSpan;
    setVp({ start: dataMax - span, end: dataMax });
  }, [windowMs, dataMin, dataMax, fullSpan]);

  const chartW = Math.max(1, width - PAD_LEFT - PAD_RIGHT);
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  // Refs so gesture callbacks read live geometry.
  const geo = useRef({ chartW, dataMin, dataMax });
  geo.current = { chartW, dataMin, dataMax };
  const base = useRef<Vp>(vp);

  const clamp = useCallback((start: number, end: number): Vp => {
    const { dataMin: lo, dataMax: hi } = geo.current;
    let span = Math.min(hi - lo, Math.max(MIN_SPAN_MS, end - start));
    let s = Math.max(lo, Math.min(start, hi - span));
    return { start: s, end: s + span };
  }, []);

  const applyPan = useCallback(
    (tx: number) => {
      const b = base.current;
      const span = b.end - b.start;
      const shift = -(tx / geo.current.chartW) * span;
      setVp(clamp(b.start + shift, b.end + shift));
    },
    [clamp],
  );

  const applyPinch = useCallback(
    (scale: number, focalX: number) => {
      const b = base.current;
      const span = b.end - b.start;
      const newSpan = span / Math.max(0.2, scale);
      const fx = Math.max(0, Math.min(1, (focalX - PAD_LEFT) / geo.current.chartW));
      const focalT = b.start + fx * span;
      const start = focalT - fx * newSpan;
      setVp(clamp(start, start + newSpan));
    },
    [clamp],
  );

  const setBase = useCallback(() => {
    base.current = vp;
  }, [vp]);

  const pan = Gesture.Pan()
    .onBegin(() => runOnJS(setBase)())
    .onUpdate((e) => runOnJS(applyPan)(e.translationX));
  const pinch = Gesture.Pinch()
    .onBegin(() => runOnJS(setBase)())
    .onUpdate((e) => runOnJS(applyPinch)(e.scale, e.focalX));
  const gesture = Gesture.Simultaneous(pan, pinch);

  const hasData = pts.length >= 2 && chartW > 1;

  const view = useMemo(() => {
    if (!hasData) return null;
    const span = Math.max(1, vp.end - vp.start);
    const xFor = (t: number) => PAD_LEFT + ((t - vp.start) / span) * chartW;
    const yFor = (p: number) => PAD_TOP + (1 - p) * plotH;
    const homePts = pts.map((h) => ({ x: xFor(h.t), y: yFor(h.mp) }));
    const awayPts = pts.map((h) => ({ x: xFor(h.t), y: yFor(1 - h.mp) }));
    const last = pts[pts.length - 1];
    const homePct = Math.round(last.mp * 100);

    // X-axis ticks (clock time) — 4 across the window.
    const ticks = [0, 0.33, 0.66, 1].map((f) => {
      const t = vp.start + f * span;
      const d = new Date(t);
      return { x: PAD_LEFT + f * chartW, label: d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) };
    });

    return { xFor, yFor, homePts, awayPts, homePct, homeY: yFor(last.mp), awayY: yFor(1 - last.mp), ticks };
  }, [hasData, vp, chartW, plotH, pts]);

  const posLines = useMemo(() => {
    if (!view || !position) return [];
    const rows: { y: number; color: string; label: string; dash?: string }[] = [];
    const push = (val: number | null | undefined, color: string, label: string, dash?: string) => {
      if (val == null || val <= 0 || val >= 1) return;
      rows.push({ y: view.yFor(val), color, label, dash });
    };
    push(position.entryPx, Brand.white, 'Entry');
    push(position.liqPrice, Brand.red, 'Liq', '4 3');
    push(position.tp, Brand.green, 'TP', '4 3');
    push(position.sl, '#e8a33d', 'SL', '4 3');
    return rows;
  }, [view, position]);

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {hasData && view ? (
        <>
          <GestureDetector gesture={gesture}>
            <Svg width={width} height={HEIGHT}>
              <Defs>
                <ClipPath id="plot">
                  <Rect x={PAD_LEFT} y={0} width={chartW} height={HEIGHT - PAD_BOTTOM} />
                </ClipPath>
              </Defs>

              {/* Y gridlines + labels (25/50/75%) */}
              {[0.25, 0.5, 0.75].map((p) => (
                <Line
                  key={p}
                  x1={PAD_LEFT}
                  y1={view.yFor(p)}
                  x2={PAD_LEFT + chartW}
                  y2={view.yFor(p)}
                  stroke={Brand.hair05}
                  strokeWidth={1}
                  strokeDasharray={p === 0.5 ? undefined : '2 6'}
                />
              ))}
              {[0.25, 0.5, 0.75].map((p) => (
                <SvgText
                  key={`l${p}`}
                  x={PAD_LEFT + 2}
                  y={view.yFor(p) - 3}
                  fill={Brand.mute}
                  fontSize={9}
                  fontFamily={F.medium}>
                  {p * 100}%
                </SvgText>
              ))}

              {/* Position reference lines (clipped to plot) */}
              <Svg clipPath="url(#plot)">
                {posLines.map((r, i) => (
                  <Line
                    key={i}
                    x1={PAD_LEFT}
                    y1={r.y}
                    x2={PAD_LEFT + chartW}
                    y2={r.y}
                    stroke={r.color}
                    strokeWidth={1}
                    strokeDasharray={r.dash}
                    opacity={0.9}
                  />
                ))}
                <Path d={line(view.awayPts)} stroke={Brand.sideAway} strokeWidth={2} fill="none" />
                <Path d={line(view.homePts)} stroke={Brand.sideHome} strokeWidth={2} fill="none" />
                <Circle cx={PAD_LEFT + chartW} cy={view.homeY} r={3} fill={Brand.sideHome} />
                <Circle cx={PAD_LEFT + chartW} cy={view.awayY} r={3} fill={Brand.sideAway} />
              </Svg>

              {/* X-axis time ticks */}
              {view.ticks.map((t, i) => (
                <SvgText
                  key={i}
                  x={t.x}
                  y={HEIGHT - 6}
                  fill={Brand.mute}
                  fontSize={9}
                  fontFamily={F.medium}
                  textAnchor={i === 0 ? 'start' : i === view.ticks.length - 1 ? 'end' : 'middle'}>
                  {t.label}
                </SvgText>
              ))}
            </Svg>
          </GestureDetector>

          {/* Position line labels (right edge) */}
          {posLines.map((r, i) => (
            <View key={i} style={[styles.posTag, { top: r.y - 8, backgroundColor: r.color + '22' }]}>
              <ThemedText type="small" style={{ color: r.color, fontSize: 10, lineHeight: 14 }}>
                {r.label}
              </ThemedText>
            </View>
          ))}

          {/* Current % pills */}
          <View style={[styles.pill, { top: clampY(view.homeY), backgroundColor: 'rgba(141,196,232,0.16)' }]}>
            <ThemedText type="smallBold" style={{ color: Brand.sideHome, fontSize: 12, lineHeight: 16 }}>
              {homeAbbr} {view.homePct}%
            </ThemedText>
          </View>
          <View style={[styles.pill, { top: clampY(view.awayY), backgroundColor: 'rgba(235,255,118,0.16)' }]}>
            <ThemedText type="smallBold" style={{ color: Brand.sideAway, fontSize: 12, lineHeight: 16 }}>
              {awayAbbr} {100 - view.homePct}%
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

function clampY(y: number): number {
  return Math.min(HEIGHT - PAD_BOTTOM - 22, Math.max(2, y - 11));
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
  posTag: {
    position: 'absolute',
    right: 0,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  emptyWrap: { alignItems: 'center' },
});
