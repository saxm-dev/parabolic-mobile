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
import type { HistoryPoint, Play, Position } from '@/lib/api';

const HEIGHT = 230;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;
const PAD_LEFT = 6;
const PAD_RIGHT = 54;
const MIN_SPAN_MS = 30_000;
const MIN_Y_RANGE = 0.12; // don't over-amplify a dead-flat game

type Vp = { start: number; end: number };

function line(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Nearest play at or before time t (for game-clock x-axis labels). */
function nearestPlay(plays: Play[], t: number): Play | null {
  let best: { w: number; p: Play } | null = null;
  for (const p of plays) {
    const w = Date.parse(p.wallclock);
    if (!Number.isNaN(w) && w <= t + 1000) {
      if (!best || w > best.w) best = { w, p };
    }
  }
  return best?.p ?? plays[0] ?? null;
}

/** Sport-native x-axis label: inning for baseball, minute for soccer, period+clock otherwise. */
function gameLabel(t: number, plays: Play[], league: string): string {
  const p = nearestPlay(plays, t);
  if (!p) return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (league === 'mlb') return ordinal(p.period || 1); // inning
  if (league === 'wcup' || league === 'mls') {
    const m = (p.clock || p.periodDisplay || '').match(/(\d+)/);
    return m ? `${m[1]}'` : p.periodDisplay || '';
  }
  // basketball / football / hockey
  const per = league === 'nhl' ? `P${p.period}` : `Q${p.period}`;
  return p.clock ? `${per} ${p.clock}` : per;
}

/** Interactive win-probability chart: auto-scaled Y, position lines, sport x-axis, pinch/pan. */
export function ProbChart({
  history,
  homeAbbr,
  awayAbbr,
  position,
  windowMs,
  plays = [],
  league = '',
}: {
  history: HistoryPoint[];
  homeAbbr: string;
  awayAbbr: string;
  position?: Position | null;
  windowMs?: number | null;
  plays?: Play[];
  league?: string;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const pts = useMemo(() => history.filter((h) => h.mp > 0 && h.mp < 1), [history]);
  const dataMin = pts.length ? pts[0].t : 0;
  const dataMax = pts.length ? pts[pts.length - 1].t : 1;
  const fullSpan = Math.max(1, dataMax - dataMin);

  const [vp, setVp] = useState<Vp>({ start: dataMin, end: dataMax });
  useEffect(() => {
    const span = windowMs && windowMs < fullSpan ? windowMs : fullSpan;
    setVp({ start: dataMax - span, end: dataMax });
  }, [windowMs, dataMin, dataMax, fullSpan]);

  const chartW = Math.max(1, width - PAD_LEFT - PAD_RIGHT);
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const geo = useRef({ chartW, dataMin, dataMax });
  geo.current = { chartW, dataMin, dataMax };
  const base = useRef<Vp>(vp);

  const clamp = useCallback((start: number, end: number): Vp => {
    const { dataMin: lo, dataMax: hi } = geo.current;
    const span = Math.min(hi - lo, Math.max(MIN_SPAN_MS, end - start));
    const s = Math.max(lo, Math.min(start, hi - span));
    return { start: s, end: s + span };
  }, []);

  const applyPan = useCallback(
    (tx: number) => {
      const b = base.current;
      const shift = -(tx / geo.current.chartW) * (b.end - b.start);
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
      setVp(clamp(focalT - fx * newSpan, focalT - fx * newSpan + newSpan));
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

    // Auto-scale Y to the visible home-prob path + position lines (± padding),
    // so balanced games amplify and nothing sits stranded in a corner.
    const visible = pts.filter((h) => h.t >= vp.start && h.t <= vp.end);
    const src = visible.length ? visible : pts;
    const vals = src.map((h) => h.mp);
    if (position) {
      [position.entryPx, position.liqPrice, position.tp, position.sl].forEach((v) => {
        if (v != null && v > 0 && v < 1) vals.push(v);
      });
    }
    let yMin = Math.min(...vals);
    let yMax = Math.max(...vals);
    const pad = Math.max(0.03, (yMax - yMin) * 0.22);
    yMin = Math.max(0, yMin - pad);
    yMax = Math.min(1, yMax + pad);
    if (yMax - yMin < MIN_Y_RANGE) {
      const c = (yMax + yMin) / 2;
      yMin = Math.max(0, c - MIN_Y_RANGE / 2);
      yMax = Math.min(1, c + MIN_Y_RANGE / 2);
    }
    const yFor = (p: number) => PAD_TOP + (1 - (p - yMin) / (yMax - yMin)) * plotH;

    const homePts = pts.map((h) => ({ x: xFor(h.t), y: yFor(h.mp) }));
    const awayPts = pts.map((h) => ({ x: xFor(h.t), y: yFor(1 - h.mp) }));
    const last = pts[pts.length - 1];
    const homePct = Math.round(last.mp * 100);

    // Y gridlines at round % levels inside the visible range.
    const gLo = Math.ceil((yMin * 100) / 10) * 10;
    const gHi = Math.floor((yMax * 100) / 10) * 10;
    const grid: number[] = [];
    for (let v = gLo; v <= gHi; v += 10) grid.push(v / 100);
    while (grid.length > 4) grid.splice(1, 1);

    const ticks = [0, 0.34, 0.67, 1].map((f) => ({
      x: PAD_LEFT + f * chartW,
      label: gameLabel(vp.start + f * span, plays, league),
    }));

    // Position reference lines
    const posLines: { y: number; color: string; label: string; dash?: string }[] = [];
    if (position) {
      const push = (val: number | null | undefined, color: string, label: string, dash?: string) => {
        if (val == null || val <= yMin || val >= yMax) return;
        posLines.push({ y: yFor(val), color, label, dash });
      };
      push(position.entryPx, Brand.white, 'Entry');
      push(position.liqPrice, Brand.red, 'Liq', '4 3');
      push(position.tp, Brand.green, 'TP', '4 3');
      push(position.sl, '#e8a33d', 'SL', '4 3');
    }

    return {
      yFor,
      homePts,
      awayPts,
      homePct,
      homeY: yFor(last.mp),
      awayY: yFor(1 - last.mp),
      ticks,
      grid,
      posLines,
    };
  }, [hasData, vp, chartW, plotH, pts, position, plays, league]);

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

              {view.grid.map((p) => (
                <Line
                  key={p}
                  x1={PAD_LEFT}
                  y1={view.yFor(p)}
                  x2={PAD_LEFT + chartW}
                  y2={view.yFor(p)}
                  stroke={Brand.hair05}
                  strokeWidth={1}
                  strokeDasharray="2 6"
                />
              ))}
              {view.grid.map((p) => (
                <SvgText
                  key={`l${p}`}
                  x={PAD_LEFT + 2}
                  y={view.yFor(p) - 3}
                  fill={Brand.mute}
                  fontSize={9}
                  fontFamily={F.medium}>
                  {Math.round(p * 100)}%
                </SvgText>
              ))}

              <Svg clipPath="url(#plot)">
                {view.posLines.map((r, i) => (
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

          {view.posLines.map((r, i) => (
            <View key={i} style={[styles.posTag, { top: r.y - 8, backgroundColor: r.color + '22' }]}>
              <ThemedText type="small" style={{ color: r.color, fontSize: 10, lineHeight: 14 }}>
                {r.label}
              </ThemedText>
            </View>
          ))}

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
