import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StepField } from '@/components/step-field';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { register } from '@/lib/auth';

export default function SignupScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'name' | 'password'>('name');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const back = () => {
    if (step === 'password') {
      setStep('name');
      setError(null);
    } else {
      router.back();
    }
  };

  const submit = async () => {
    setError(null);
    if (step === 'name') {
      const name = username.trim();
      if (name.length < 3) {
        setError('Pick a name with at least 3 characters.');
        return;
      }
      setStep('password');
      return;
    }
    if (password.length < 6) {
      setError('Password needs at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      await register(username.trim(), password);
      router.dismissAll?.();
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable onPress={back} style={styles.backBtn} hitSlop={8}>
          <ThemedText style={{ color: Brand.white, fontSize: 20, lineHeight: 24 }}>←</ThemedText>
        </Pressable>
      </View>
      {step === 'name' ? (
        <StepField
          label="What’s your name"
          value={username}
          onChange={setUsername}
          onSubmit={submit}
          error={error}
        />
      ) : (
        <StepField
          label="Choose a password"
          value={password}
          onChange={setPassword}
          onSubmit={submit}
          secure
          error={error}
          busy={busy}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  nav: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
