import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { api, setTokens } from '@/api/client';

export default function Login() {
  const { palette, radii, spacing } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    !!email && !!password && (mode === 'login' || !!name);

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res =
        mode === 'login'
          ? await api.login(email.trim(), password)
          : await api.register(email.trim(), name.trim(), password);
      await setTokens(res.accessToken, res.refreshToken);
      router.replace('/(app)/tasks');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.xl, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.eyebrow, { color: palette.textTertiary }]}>
            {mode === 'login' ? 'welcome back' : 'new here'}
          </Text>
          <Text style={[styles.headline, { color: palette.textPrimary }]}>
            {mode === 'login' ? 'Sign in.' : 'Create account.'}
          </Text>

          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            {mode === 'register' && (
              <Input
                placeholder="your name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            )}
            <Input
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Input
              placeholder="password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {error && (
            <Text
              style={[styles.error, { color: palette.danger, marginTop: spacing.md }]}
            >
              {error}
            </Text>
          )}

          <Pressable
            onPress={submit}
            disabled={loading || !canSubmit}
            style={({ pressed }) => [
              styles.primary,
              {
                backgroundColor: palette.accent,
                borderRadius: radii.lg,
                marginTop: spacing.xl,
                opacity: pressed || loading || !canSubmit ? 0.6 : 1,
                paddingVertical: spacing.md + 2,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={palette.textInverse} />
            ) : (
              <Text style={[styles.primaryLabel, { color: palette.textInverse }]}>
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              setMode((m) => (m === 'login' ? 'register' : 'login'));
              setError(null);
            }}
            style={{ marginTop: spacing.lg, alignItems: 'center' }}
          >
            <Text
              style={{
                color: palette.textSecondary,
                fontFamily: 'Inter_400Regular',
              }}
            >
              {mode === 'login'
                ? "New here? Create an account"
                : 'Already have one? Sign in'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  const { palette, radii, spacing } = useTheme();
  const [focused, setFocused] = React.useState(false);
  return (
    <TextInput
      {...props}
      placeholderTextColor={palette.textTertiary}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[
        {
          backgroundColor: palette.surface,
          borderColor: focused ? palette.borderFocus : palette.border,
          borderWidth: 1,
          borderRadius: radii.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          fontSize: 16,
          color: palette.textPrimary,
          fontFamily: 'Inter_400Regular',
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontFamily: 'Inter_500Medium',
  },
  headline: {
    fontSize: 36,
    fontFamily: 'Fraunces_600SemiBold',
    letterSpacing: -0.5,
  },
  primary: { alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  error: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
