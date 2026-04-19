import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { api, setTokens } from '@/api/client';
import { haptic } from '@/haptics';

export default function Login() {
  const { palette, radii, spacing, fontSize } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!email && !!password && (mode === 'login' || !!name);

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
      haptic.success();
      router.replace('/(app)/tasks');
    } catch (e) {
      haptic.warning();
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (target: 'login' | 'register') => {
    setMode(target);
    setError(null);
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingTop: spacing['2xl'],
            paddingBottom: spacing.xl,
            flexGrow: 1,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: palette.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: palette.textInverse,
                  fontFamily: 'Fraunces_600SemiBold',
                  fontSize: 15,
                }}
              >
                U
              </Text>
            </View>
            <Text
              style={{
                color: palette.textPrimary,
                fontFamily: 'Fraunces_600SemiBold',
                fontSize: fontSize.lg,
                letterSpacing: -0.3,
              }}
            >
              Urban Tasks
              <Text style={{ color: palette.textTertiary }}>.</Text>
            </Text>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignSelf: 'flex-start',
              padding: 4,
              marginTop: spacing.xl,
              backgroundColor: palette.bgSecondary,
              borderRadius: radii.pill,
            }}
          >
            {(['login', 'register'] as const).map((m) => {
              const active = mode === m;
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => switchMode(m)}
                  activeOpacity={0.85}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: 7,
                    borderRadius: radii.pill,
                    backgroundColor: active ? palette.textPrimary : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      color: active ? palette.bg : palette.textSecondary,
                      fontFamily: 'Inter_500Medium',
                      fontSize: fontSize.xs,
                    }}
                  >
                    {m === 'login' ? 'Sign in' : 'New here'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              marginTop: spacing.xl,
            }}
          >
            <View
              style={{
                width: 32,
                height: 1,
                backgroundColor: palette.border,
              }}
            />
            <Text
              style={{
                color: palette.textTertiary,
                fontSize: fontSize['2xs'],
                letterSpacing: 3,
                textTransform: 'uppercase',
                fontFamily: 'Inter_500Medium',
              }}
            >
              {mode === 'login' ? 'Welcome back' : 'Create an account'}
            </Text>
          </View>

          <Text
            style={{
              color: palette.textPrimary,
              fontFamily: 'Fraunces_400Regular',
              fontSize: 40,
              lineHeight: 44,
              letterSpacing: -0.8,
              marginTop: spacing.sm,
            }}
          >
            {mode === 'login' ? 'Pick up\n' : 'Begin with\n'}
            <Text
              style={{
                fontFamily: 'Fraunces_400Regular',
                fontStyle: 'italic',
              }}
            >
              {mode === 'login' ? 'where you left off.' : 'a blank street.'}
            </Text>
          </Text>

          {error && (
            <View
              style={{
                marginTop: spacing.lg,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm + 2,
                borderRadius: radii.md,
                backgroundColor: palette.dangerBg,
                borderWidth: 1,
                borderColor: palette.danger + '55',
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <AlertCircle size={16} color={palette.danger} style={{ marginTop: 1 }} />
              <Text
                style={{
                  flex: 1,
                  color: palette.danger,
                  fontFamily: 'Inter_400Regular',
                  fontSize: fontSize.sm,
                  lineHeight: 19,
                }}
              >
                {error}
              </Text>
            </View>
          )}

          <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
            {mode === 'register' && (
              <UnderlineField
                label="Name"
                value={name}
                onChangeText={setName}
                placeholder="What should we call you?"
                autoCapitalize="words"
              />
            )}
            <UnderlineField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@somewhere.co"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <UnderlineField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
              secureTextEntry={!showPassword}
              rightAdornment={
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={10}
                >
                  {showPassword ? (
                    <EyeOff size={16} color={palette.textTertiary} />
                  ) : (
                    <Eye size={16} color={palette.textTertiary} />
                  )}
                </TouchableOpacity>
              }
            />
          </View>

          <TouchableOpacity
            onPress={submit}
            disabled={loading || !canSubmit}
            activeOpacity={0.85}
            style={{
              marginTop: spacing.xl,
              backgroundColor: palette.textPrimary,
              borderRadius: radii.pill,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md + 2,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              opacity: !canSubmit ? 0.5 : 1,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {loading && <ActivityIndicator color={palette.bg} size="small" />}
              <Text
                style={{
                  color: palette.bg,
                  fontFamily: 'Inter_500Medium',
                  fontSize: fontSize.base,
                }}
              >
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </Text>
            </View>
            <ArrowRight size={16} color={palette.bg} />
          </TouchableOpacity>

          <Text
            style={{
              marginTop: spacing.xl,
              color: palette.textSecondary,
              fontFamily: 'Inter_400Regular',
              fontSize: fontSize.sm,
            }}
          >
            {mode === 'login' ? "Don't have an account yet? " : 'Already have one? '}
            <Text
              onPress={() => switchMode(mode === 'login' ? 'register' : 'login')}
              style={{
                color: palette.textPrimary,
                fontFamily: 'Inter_500Medium',
                textDecorationLine: 'underline',
              }}
            >
              {mode === 'login' ? 'Start here' : 'Sign in'}
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface UnderlineFieldProps extends React.ComponentProps<typeof TextInput> {
  label: string;
  rightAdornment?: React.ReactNode;
}

function UnderlineField({ label, rightAdornment, ...props }: UnderlineFieldProps) {
  const { palette, fontSize } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Text
        style={{
          color: palette.textTertiary,
          fontSize: fontSize['2xs'],
          letterSpacing: 2,
          textTransform: 'uppercase',
          fontFamily: 'Inter_500Medium',
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: focused ? palette.accent : palette.border,
          paddingBottom: 4,
        }}
      >
        <TextInput
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          placeholderTextColor={palette.textTertiary}
          style={{
            flex: 1,
            paddingVertical: 6,
            fontSize: fontSize.md,
            color: palette.textPrimary,
            fontFamily: 'Inter_400Regular',
          }}
        />
        {rightAdornment}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
