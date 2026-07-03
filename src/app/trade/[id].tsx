import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SlideToConfirm } from '@/components/slide-to-confirm';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useAccount } from '@/hooks/use-account';
import { fetchGameDetail, type GameDetail } from '@/lib/api';
import { fetchMarket, placeWager } from '@/lib/trade';

const TAKER_FEE = 0.001; // 10 bps

function fmtUsd(n: number, digits = 2): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function homeProb(g: GameDetail | null): number | null {
  const o = g?.oracle;
  if (!o) return null;
  const p = o.markPrice > 0 ? o.markPrice : o.indexPrice;
  if (!p || p <= 0 || p >= 1) return null;
  return p;
}

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
];

export default function TradeScreen() {
  const { id, side: sideParam } = useLocalSearchParams<{ id: string; side?: string }>();
  const side: 'home' | 'away' = sideParam === 'away' ? 'away' : 'home';
  const router = useRouter();
  const { balance } = useAccount(30_000);

  const [game, setGame] = useState<GameDetail | null>(null);
  const [maxLev, setMaxLev] = useState(10);
  const [amountStr, setAmountStr] = useState('0');
  const [leverage, setLeverage] = useState(1);
  const [autoCashOut, setAutoCashOut] = useState(false);
  const [tpPct, setTpPct] = useState(25); // take-profit as +% of stake
  const [slPct, setSlPct] = useState(25); // stop-loss as -% of stake
  const [slOn, setSlOn] = useState(false);
  const [sheet, setSheet] = useState<'none' | 'leverage' | 'cashout'>('none');
  const [step, setStep] = useState<'amount' | 'review'>('amount');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [g, m] = await Promise.all([fetchGameDetail(id), fetchMarket(id)]);
      if (!mounted.current) return;
      setGame(g);
      const cap = m.maxLeverageBySide?.[side] ?? m.maxLeverage ?? 10;
      setMaxLev(Math.max(1, Math.round(cap)));
      setLeverage((l) => Math.min(l, Math.max(1, Math.round(cap))));
    } catch {}
  }, [id, side]);

  useEffect(() => {
    mounted.current = true;
    load();
    const t = setInterval(load, 10_000);
    return () => {
      mounted.current = false;
      clearInterval(t);
    };
  }, [load]);

  const team = game ? (side === 'home' ? game.home : game.away) : null;
  const p = homeProb(game);
  const sidePrice = p == null ? null : side === 'home' ? p : 1 - p;
  const sidePct = sidePrice == null ? null : Math.round(sidePrice * 100);

  const amount = parseFloat(amountStr) || 0;
  const notional = amount * leverage;
  const shares = sidePrice && sidePrice > 0 ? notional / sidePrice : 0;
  const fee = notional * TAKER_FEE;
  const liqSide = sidePrice == null ? null : sidePrice * (1 - 1 / leverage);
  const liqPct = liqSide == null ? null : Math.max(0, Math.round(liqSide * 100));
  const liqAwayPts = sidePrice == null ? 0 : (sidePrice * 100) / leverage;
  const payoutIfWin = sidePrice ? amount + shares * (1 - sidePrice) - fee : 0;
  const available = balance?.availableBalance ?? 0;
  const canReview = amount >= 1 && sidePrice != null && amount <= available && !busy;

  const key = (k: string) => {
    setAmountStr((prev) => {
      if (k === '⌫') return prev.length <= 1 ? '0' : prev.slice(0, -1);
      if (k === '.') return prev.includes('.') ? prev : prev + '.';
      const next = prev === '0' ? k : prev + k;
      const [, dec] = next.split('.');
      if (dec && dec.length > 2) return prev;
      if (parseFloat(next) > 100_000) return prev;
      return next;
    });
  };
  const addChip = (n: number) => setAmountStr((prev) => String(Math.round(((parseFloat(prev) || 0) + n) * 100) / 100));

  const submit = async () => {
    if (!game || !sidePrice || busy) return;
    setBusy(true);
    setError(null);
    try {
      await placeWager({
        gameId: game.id,
        side,
        budget: amount,
        sizeEstimate: shares,
        leverage,
        tp: autoCashOut ? tpPrice() : null,
        sl: slOn ? slPrice() : null,
      });
      const msg = `Bet placed ✓  ${fmtUsd(amount)} on ${team?.name ?? side} at ${sidePct}%`;
      if (Platform.OS === 'web') window.alert(msg);
      else Alert.alert('Bet placed ✓', msg);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Order failed');
      setStep('amount');
    } finally {
      setBusy(false);
    }
  };

  // TP/SL are prices on the HOME-prob axis (engine convention). Convert the
  // ±% of stake into the side-price move that produces that P&L, then map to
  // the home axis for away positions.
  function tpPrice(): number {
    if (!sidePrice) return 0;
    const move = (sidePrice / leverage) * (tpPct / 100) * leverage; // = sidePrice * pct/100
    const target = Math.min(0.999, sidePrice + (sidePrice * (tpPct / 100)) / leverage);
    void move;
    return +(side === 'home' ? target : 1 - target).toFixed(3);
  }
  function slPrice(): number {
    if (!sidePrice) return 0;
    const target = Math.max(0.001, sidePrice - (sidePrice * (slPct / 100)) / leverage);
    return +(side === 'home' ? target : 1 - target).toFixed(3);
  }

  if (step === 'review' && game && team && sidePrice != null) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.navRow}>
          <Pressable onPress={() => setStep('amount')} style={styles.roundBtn} hitSlop={8}>
            <ThemedText style={styles.roundBtnText}>←</ThemedText>
          </Pressable>
          <ThemedText type="smallBold" style={{ color: Brand.white, fontSize: 16 }}>
            Review your bet
          </ThemedText>
          <View style={styles.roundBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.reviewContent}>
          <View style={styles.badgeWrap}>
            <ThemedText type="smallBold" style={styles.badgeCaption}>
              BETTING ON
            </ThemedText>
            <View style={styles.badge}>
              <Image source={{ uri: team.logo }} style={styles.badgeLogo} contentFit="contain" />
            </View>
            <ThemedText type="smallBold" style={styles.badgeCaption}>
              {team.abbreviation} TO WIN
            </ThemedText>
          </View>

          <View style={{ alignItems: 'center', gap: 4 }}>
            <ThemedText style={styles.reviewAmount}>{fmtUsd(amount)}</ThemedText>
            <ThemedText type="small" style={{ color: Brand.mute, letterSpacing: 1.5 }}>
              YOUR BET
            </ThemedText>
          </View>

          <View style={{ gap: Spacing.two }}>
            <Row label="Entry" value={`${sidePct}%`} />
            <Row label="Leverage" value={`${leverage}x`} />
            <Row label="Liquidation" value={`~${liqPct}%`} />
            <Row
              label="Auto cash-out"
              value={
                autoCashOut
                  ? `TP +${fmtUsd((amount * tpPct) / 100, 0)}${slOn ? ` · SL −${fmtUsd((amount * slPct) / 100, 0)}` : ''}`
                  : 'Off'
              }
            />
          </View>

          <View style={styles.outcomeCard}>
            <View style={styles.outcomeRow}>
              <ThemedText style={{ color: Brand.dim }}>Max loss</ThemedText>
              <ThemedText type="smallBold" style={{ color: Brand.red, fontSize: 16 }}>
                {fmtUsd(amount)}
              </ThemedText>
            </View>
            <View style={[styles.outcomeRow, { borderTopWidth: 1, borderTopColor: Brand.border }]}>
              <ThemedText style={{ color: Brand.dim }}>Payout if win</ThemedText>
              <ThemedText type="smallBold" style={{ color: Brand.primary, fontSize: 16 }}>
                {fmtUsd(payoutIfWin)}
              </ThemedText>
            </View>
          </View>
        </ScrollView>

        <View style={{ padding: Spacing.three }}>
          {!!error && (
            <ThemedText type="small" style={{ color: Brand.red, marginBottom: Spacing.two }}>
              {error}
            </ThemedText>
          )}
          <SlideToConfirm label={busy ? 'Placing…' : 'Slide to confirm'} onConfirm={submit} disabled={busy} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.navRow}>
        <Pressable onPress={() => router.back()} style={styles.roundBtn} hitSlop={8}>
          <ThemedText style={styles.roundBtnText}>✕</ThemedText>
        </Pressable>
        <View style={styles.buyLabel}>
          {team && <Image source={{ uri: team.logo }} style={styles.buyFlag} contentFit="contain" />}
          <ThemedText type="smallBold" style={{ color: Brand.white, fontSize: 16 }}>
            Buy {team?.abbreviation ?? '…'}{sidePct != null ? ` at ${sidePct}%` : ''}
          </ThemedText>
        </View>
        <View style={styles.balancePill}>
          <ThemedText type="small" style={{ color: Brand.dim }}>
            {balance ? fmtUsd(balance.availableBalance) : '—'}
          </ThemedText>
        </View>
      </View>

      <View style={styles.amountWrap}>
        <ThemedText style={styles.amount}>{fmtUsd(amount, amountStr.includes('.') ? 2 : 0)}</ThemedText>
        <ThemedText type="small" style={{ color: Brand.mute }}>
          {sidePrice
            ? `${Math.floor(shares).toLocaleString()} shares · ${Math.round(sidePrice * 100)}¢ per share`
            : 'Market price loading…'}
        </ThemedText>
        <View style={styles.chipsRow}>
          {[1, 2, 5, 10].map((n) => (
            <Pressable key={n} onPress={() => addChip(n)} style={styles.addChip}>
              <ThemedText type="small" style={{ color: Brand.dim }}>
                +${n}
              </ThemedText>
            </Pressable>
          ))}
        </View>
        {!!error && (
          <ThemedText type="small" style={{ color: Brand.red }}>
            {error}
          </ThemedText>
        )}
        {amount > available && (
          <ThemedText type="small" style={{ color: Brand.red }}>
            That’s more than your available balance.
          </ThemedText>
        )}
      </View>

      <View style={styles.settings}>
        <Pressable style={styles.settingRow} onPress={() => setSheet('leverage')}>
          <View style={{ flex: 1 }}>
            <ThemedText style={{ color: Brand.white, fontWeight: '600' }}>Leverage</ThemedText>
            <ThemedText type="small" style={{ color: Brand.mute }}>
              {liqPct != null ? `Liquidation at ~${liqPct}%` : '—'}
            </ThemedText>
          </View>
          <ThemedText style={{ color: Brand.white, fontWeight: '700' }}>{leverage}x ›</ThemedText>
        </Pressable>
        <View style={styles.settingDivider} />
        <Pressable style={styles.settingRow} onPress={() => setSheet('cashout')}>
          <View style={{ flex: 1 }}>
            <ThemedText style={{ color: Brand.white, fontWeight: '600' }}>Auto cash-out</ThemedText>
            <ThemedText type="small" style={{ color: Brand.mute }}>
              {autoCashOut
                ? `TP +${fmtUsd((amount * tpPct) / 100, 0)}${slOn ? ` · SL −${fmtUsd((amount * slPct) / 100, 0)}` : ''}`
                : 'Off'}
            </ThemedText>
          </View>
          <Switch
            value={autoCashOut}
            onValueChange={(v) => {
              setAutoCashOut(v);
              if (v) setSheet('cashout');
            }}
            trackColor={{ true: Brand.primary, false: Brand.border2 }}
            thumbColor="#fff"
          />
        </Pressable>
      </View>

      <View style={styles.keypad}>
        {KEYS.map((row) => (
          <View key={row[0]} style={styles.keyRow}>
            {row.map((k) => (
              <Pressable key={k} onPress={() => key(k)} style={styles.key}>
                <ThemedText style={styles.keyText}>{k}</ThemedText>
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      <View style={{ paddingHorizontal: Spacing.three, paddingBottom: Spacing.two }}>
        <Pressable
          onPress={() => canReview && setStep('review')}
          style={[styles.reviewBtn, !canReview && { opacity: 0.4 }]}>
          <ThemedText style={{ color: Brand.ctaText, fontSize: 17, fontWeight: '700' }}>
            Review
          </ThemedText>
        </Pressable>
      </View>

      {/* ── Leverage sheet ─────────────────────────────────────────── */}
      <Modal visible={sheet === 'leverage'} transparent animationType="slide" onRequestClose={() => setSheet('none')}>
        <Pressable style={styles.backdrop} onPress={() => setSheet('none')} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <ThemedText style={styles.sheetValue}>{leverage}x</ThemedText>
          <ThemedText type="small" style={{ color: Brand.dim, textAlign: 'center' }}>
            Leverage
          </ThemedText>
          <View style={styles.levRow}>
            <Pressable onPress={() => setLeverage((l) => Math.max(1, l - 1))} style={styles.stepBtn}>
              <ThemedText style={styles.stepText}>−</ThemedText>
            </Pressable>
            <View style={styles.levTrack}>
              {Array.from({ length: maxLev }, (_, i) => i + 1).map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setLeverage(v)}
                  style={[styles.levTick, v <= leverage && { backgroundColor: Brand.cta }]}
                />
              ))}
            </View>
            <Pressable onPress={() => setLeverage((l) => Math.min(maxLev, l + 1))} style={styles.stepBtn}>
              <ThemedText style={styles.stepText}>+</ThemedText>
            </Pressable>
          </View>
          <View style={styles.levScale}>
            <ThemedText type="small" style={{ color: Brand.mute }}>1x</ThemedText>
            <ThemedText type="small" style={{ color: Brand.mute }}>{maxLev}x</ThemedText>
          </View>
          <View style={styles.liqCard}>
            <View style={{ flex: 1 }}>
              <ThemedText style={{ color: Brand.white, fontWeight: '600' }}>
                Liquidation at ~{liqPct ?? '—'}%
              </ThemedText>
              <ThemedText type="small" style={{ color: Brand.mute }}>
                Only {liqAwayPts.toFixed(1)} pts away
              </ThemedText>
            </View>
            {liqAwayPts < 10 && (
              <View style={styles.riskPill}>
                <ThemedText type="smallBold" style={{ color: Brand.red, fontSize: 12 }}>
                  High risk
                </ThemedText>
              </View>
            )}
          </View>
          {leverage > 3 && (
            <View style={styles.warnBar}>
              <ThemedText type="small" style={{ color: '#e8a33d' }}>
                Setting a higher leverage increases the risk of liquidation
              </ThemedText>
            </View>
          )}
          <Pressable onPress={() => setSheet('none')} style={styles.sheetCta}>
            <ThemedText style={{ color: Brand.ctaText, fontWeight: '700', fontSize: 17 }}>Confirm</ThemedText>
          </Pressable>
        </View>
      </Modal>

      {/* ── Auto cash-out sheet ─────────────────────────────────────── */}
      <Modal visible={sheet === 'cashout'} transparent animationType="slide" onRequestClose={() => setSheet('none')}>
        <Pressable style={styles.backdrop} onPress={() => setSheet('none')} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <ThemedText type="smallBold" style={{ color: Brand.white, fontSize: 17, textAlign: 'center' }}>
            Auto cash-out
          </ThemedText>

          <View style={styles.tpCard}>
            <View style={styles.tpHeader}>
              <ThemedText style={{ color: Brand.white, fontWeight: '600' }}>Take profit</ThemedText>
              <Switch
                value={autoCashOut}
                onValueChange={setAutoCashOut}
                trackColor={{ true: Brand.primary, false: Brand.border2 }}
                thumbColor="#fff"
              />
            </View>
            {autoCashOut && (
              <>
                <ThemedText type="small" style={{ color: Brand.mute }}>Cash out at</ThemedText>
                <View style={styles.tpValueRow}>
                  <ThemedText style={styles.tpValue}>{fmtUsd(amount * (1 + tpPct / 100))}</ThemedText>
                  <View style={styles.deltaPill}>
                    <ThemedText type="smallBold" style={{ color: Brand.primary, fontSize: 13 }}>
                      +{fmtUsd((amount * tpPct) / 100)}
                    </ThemedText>
                  </View>
                </View>
                <PctStepper value={tpPct} setValue={setTpPct} min={5} max={300} />
              </>
            )}
          </View>

          <View style={styles.tpCard}>
            <View style={styles.tpHeader}>
              <ThemedText style={{ color: Brand.white, fontWeight: '600' }}>Stop loss</ThemedText>
              <Switch
                value={slOn}
                onValueChange={setSlOn}
                trackColor={{ true: Brand.primary, false: Brand.border2 }}
                thumbColor="#fff"
              />
            </View>
            {slOn && (
              <>
                <ThemedText type="small" style={{ color: Brand.mute }}>Cash out at</ThemedText>
                <View style={styles.tpValueRow}>
                  <ThemedText style={styles.tpValue}>{fmtUsd(amount * (1 - slPct / 100))}</ThemedText>
                  <View style={[styles.deltaPill, { backgroundColor: 'rgba(255,82,71,0.14)' }]}>
                    <ThemedText type="smallBold" style={{ color: Brand.red, fontSize: 13 }}>
                      −{fmtUsd((amount * slPct) / 100)}
                    </ThemedText>
                  </View>
                </View>
                <PctStepper value={slPct} setValue={setSlPct} min={5} max={95} />
              </>
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <Pressable
              onPress={() => {
                setAutoCashOut(false);
                setSlOn(false);
                setSheet('none');
              }}
              style={[styles.sheetCta, { flex: 1, backgroundColor: Brand.surface }]}>
              <ThemedText style={{ color: Brand.white, fontWeight: '600' }}>Cancel</ThemedText>
            </Pressable>
            <Pressable onPress={() => setSheet('none')} style={[styles.sheetCta, { flex: 1.4 }]}>
              <ThemedText style={{ color: Brand.ctaText, fontWeight: '700' }}>Confirm</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kvRow}>
      <ThemedText style={{ color: Brand.dim }}>{label}</ThemedText>
      <ThemedText style={{ color: Brand.white, fontWeight: '600' }}>{value}</ThemedText>
    </View>
  );
}

function PctStepper({
  value,
  setValue,
  min,
  max,
}: {
  value: number;
  setValue: (fn: (v: number) => number) => void;
  min: number;
  max: number;
}) {
  return (
    <View style={styles.pctRow}>
      <Pressable onPress={() => setValue((v) => Math.max(min, v - 5))} style={styles.stepBtnSmall}>
        <ThemedText style={styles.stepText}>−</ThemedText>
      </Pressable>
      <View style={styles.pctPill}>
        <ThemedText type="smallBold" style={{ color: Brand.white }}>
          {value >= 0 ? '+' : ''}
          {value}%
        </ThemedText>
      </View>
      <Pressable onPress={() => setValue((v) => Math.min(max, v + 5))} style={styles.stepBtnSmall}>
        <ThemedText style={styles.stepText}>+</ThemedText>
      </Pressable>
      <View style={styles.pctScale}>
        <ThemedText type="small" style={{ color: Brand.mute, fontSize: 11 }}>{min}%</ThemedText>
        <ThemedText type="small" style={{ color: Brand.mute, fontSize: 11 }}>{max}%</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBtnText: { color: Brand.white, fontSize: 18, lineHeight: 22 },
  buyLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' },
  buyFlag: { width: 22, height: 22, borderRadius: 11 },
  balancePill: {
    backgroundColor: Brand.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  amountWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  amount: { color: Brand.white, fontSize: 56, lineHeight: 64, fontWeight: '700' },
  chipsRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  addChip: {
    borderWidth: 1,
    borderColor: Brand.border2,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  settings: {
    marginHorizontal: Spacing.three,
    backgroundColor: Brand.card,
    borderRadius: 16,
    marginBottom: Spacing.two,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    gap: Spacing.two,
  },
  settingDivider: { height: 1, backgroundColor: Brand.border },
  keypad: { paddingHorizontal: Spacing.three, gap: 4 },
  keyRow: { flexDirection: 'row' },
  key: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  keyText: { color: Brand.white, fontSize: 24, lineHeight: 32, fontWeight: '500' },
  reviewBtn: {
    backgroundColor: Brand.cta,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#121316',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.three,
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: Brand.border2,
    marginBottom: Spacing.one,
  },
  sheetValue: { color: Brand.white, fontSize: 44, lineHeight: 52, fontWeight: '800', textAlign: 'center' },
  levRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  levTrack: { flex: 1, flexDirection: 'row', gap: 4, alignItems: 'center' },
  levTick: { flex: 1, height: 10, borderRadius: 5, backgroundColor: Brand.border2 },
  levScale: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 56 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: Brand.white, fontSize: 20, lineHeight: 24 },
  liqCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.surface,
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  riskPill: {
    backgroundColor: 'rgba(255,82,71,0.14)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  warnBar: {
    backgroundColor: 'rgba(232,163,61,0.12)',
    borderRadius: 10,
    paddingHorizontal: Spacing.two + 4,
    paddingVertical: Spacing.two,
  },
  sheetCta: {
    backgroundColor: Brand.cta,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  tpCard: { backgroundColor: Brand.surface, borderRadius: 16, padding: Spacing.three, gap: 6 },
  tpHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tpValueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  tpValue: { color: Brand.white, fontSize: 30, lineHeight: 38, fontWeight: '700' },
  deltaPill: {
    backgroundColor: 'rgba(31,209,130,0.14)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pctRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: 4 },
  pctPill: {
    backgroundColor: Brand.card,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  pctScale: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', paddingLeft: Spacing.two },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
  },
  reviewContent: { padding: Spacing.three, gap: Spacing.four },
  badgeWrap: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two },
  badge: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Brand.card,
    borderWidth: 2,
    borderColor: '#2a2417',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLogo: { width: 64, height: 64, borderRadius: 32 },
  badgeCaption: { color: '#c9a84c', letterSpacing: 2, fontSize: 12 },
  reviewAmount: { color: Brand.white, fontSize: 52, lineHeight: 60, fontWeight: '700' },
  outcomeCard: { backgroundColor: Brand.card, borderRadius: 16 },
  outcomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
  },
});
