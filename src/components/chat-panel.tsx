import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { fetchChat, sendChat, type ChatMessage } from '@/lib/chat';

const POLL_MS = 4_000;

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

function Message({ m, homeAbbr, awayAbbr }: { m: ChatMessage; homeAbbr: string; awayAbbr: string }) {
  if (m.type === 'bet') {
    return (
      <View style={styles.betMsg}>
        <ThemedText type="small" style={{ color: Brand.primary }}>
          ⚡ {m.text}
        </ThemedText>
      </View>
    );
  }
  const posAbbr = m.pos ? (m.pos.side === 'home' ? homeAbbr : awayAbbr) : null;
  const posColor = m.pos?.side === 'home' ? Brand.sideHome : Brand.sideAway;
  return (
    <View style={styles.userMsg}>
      <View style={styles.msgHeader}>
        <ThemedText type="smallBold" style={{ color: Brand.white }}>
          {m.username}
        </ThemedText>
        {posAbbr && (
          <View style={[styles.posChip, { backgroundColor: `${posColor}22` }]}>
            <ThemedText type="small" style={{ color: posColor, fontSize: 11, lineHeight: 14 }}>
              {posAbbr} ${m.pos!.notional.toLocaleString()}
            </ThemedText>
          </View>
        )}
        <ThemedText type="small" style={{ color: Brand.mute, fontSize: 11, lineHeight: 14 }}>
          {timeAgo(m.ts)}
        </ThemedText>
      </View>
      <ThemedText type="small" style={{ color: Brand.dim }}>
        {m.text}
      </ThemedText>
    </View>
  );
}

export function ChatPanel({
  gameId,
  homeAbbr,
  awayAbbr,
}: {
  gameId: string;
  homeAbbr: string;
  awayAbbr: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const msgs = await fetchChat(gameId);
    if (mounted.current) setMessages(msgs);
  }, [gameId]);

  useEffect(() => {
    mounted.current = true;
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(t);
    };
  }, [load]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const m = await sendChat(gameId, text);
      setDraft('');
      setMessages((prev) => [...prev, m]);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Message failed to send');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.wrap}>
        <ScrollView
          ref={scrollRef}
          style={styles.list}
          contentContainerStyle={{ gap: Spacing.two, paddingBottom: Spacing.two }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
          {messages.length === 0 ? (
            <ThemedText type="small" style={styles.empty}>
              No messages yet — say something.
            </ThemedText>
          ) : (
            messages.map((m) => (
              <Message key={m.id} m={m} homeAbbr={homeAbbr} awayAbbr={awayAbbr} />
            ))
          )}
        </ScrollView>
        {!!error && (
          <ThemedText type="small" style={{ color: Brand.red }}>
            {error}
          </ThemedText>
        )}
        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={submit}
            placeholder="Say something…"
            placeholderTextColor={Brand.mute}
            style={styles.input}
            returnKeyType="send"
            maxLength={280}
          />
          <Pressable
            onPress={submit}
            disabled={busy || !draft.trim()}
            style={[styles.sendBtn, (busy || !draft.trim()) && { opacity: 0.4 }]}>
            <ThemedText style={{ color: Brand.ctaText, fontSize: 16, lineHeight: 20 }}>→</ThemedText>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
  list: { maxHeight: 360 },
  empty: { color: Brand.mute, textAlign: 'center', marginVertical: Spacing.three },
  betMsg: {
    backgroundColor: 'rgba(31,209,130,0.08)',
    borderRadius: 10,
    paddingHorizontal: Spacing.two + 4,
    paddingVertical: Spacing.two,
  },
  userMsg: {
    backgroundColor: Brand.card,
    borderRadius: 10,
    paddingHorizontal: Spacing.two + 4,
    paddingVertical: Spacing.two,
    gap: 2,
  },
  msgHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  posChip: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.surface,
    borderRadius: 999,
    paddingLeft: 16,
    paddingRight: 6,
    height: 46,
    gap: 8,
  },
  input: { flex: 1, color: Brand.white, fontSize: 15, height: '100%' },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Brand.cta,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
