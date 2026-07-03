import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';

/**
 * One-question-per-screen input, keyboard up, label just above the field
 * with a circular submit arrow inside it (Figma 63:2294 pattern).
 */
export function StepField({
  label,
  value,
  onChange,
  onSubmit,
  secure,
  error,
  busy,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  secure?: boolean;
  error?: string | null;
  busy?: boolean;
}) {
  const ref = useRef<TextInput>(null);
  const [focusedOnce, setFocusedOnce] = useState(false);

  useEffect(() => {
    if (!focusedOnce) {
      const t = setTimeout(() => {
        ref.current?.focus();
        setFocusedOnce(true);
      }, 350);
      return () => clearTimeout(t);
    }
  }, [focusedOnce]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.bottom}>
        {!!error && (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        )}
        <ThemedText style={styles.label}>{label}</ThemedText>
        <View style={styles.inputWrap}>
          <TextInput
            ref={ref}
            value={value}
            onChangeText={onChange}
            onSubmitEditing={onSubmit}
            secureTextEntry={secure}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            style={styles.input}
            selectionColor={Brand.primary}
            placeholderTextColor={Brand.mute}
          />
          <Pressable
            onPress={onSubmit}
            disabled={busy}
            style={[styles.submitBtn, busy && { opacity: 0.5 }]}
            hitSlop={6}>
            <ThemedText style={{ color: Brand.ctaText, fontSize: 18, lineHeight: 22 }}>→</ThemedText>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bottom: { flex: 1, justifyContent: 'flex-end', padding: Spacing.three, gap: Spacing.two },
  error: { color: Brand.red },
  label: { color: Brand.white, fontSize: 20, lineHeight: 28, fontWeight: '700' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.surface,
    borderRadius: 999,
    paddingLeft: 20,
    paddingRight: 8,
    height: 56,
    marginBottom: Spacing.two,
  },
  input: {
    flex: 1,
    color: Brand.white,
    fontSize: 17,
    height: '100%',
  },
  submitBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.cta,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
