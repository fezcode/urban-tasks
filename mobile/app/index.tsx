import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { getToken } from '@/api/client';

export default function Landing() {
  const { palette, radii, spacing } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) router.replace('/(app)/tasks');
      else setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: palette.bg }]}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
      <View style={[styles.container, { padding: spacing.xl }]}>
        <Text style={[styles.eyebrow, { color: palette.textTertiary }]}>urban tasks</Text>
        <Text style={[styles.headline, { color: palette.textPrimary }]}>
          The quiet place{'\n'}for loud to-dos.
        </Text>
        <Text style={[styles.sub, { color: palette.textSecondary, marginTop: spacing.md }]}>
          A calm, deliberate task manager. Same account as the web app.
        </Text>

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={() => router.push('/login')}
          style={({ pressed }) => [
            styles.primary,
            {
              backgroundColor: palette.accent,
              borderRadius: radii.lg,
              opacity: pressed ? 0.9 : 1,
              paddingVertical: spacing.md + 2,
            },
          ]}
        >
          <Text style={[styles.primaryLabel, { color: palette.textInverse }]}>
            Continue with email
          </Text>
        </Pressable>

        <Text
          style={[
            styles.footer,
            { color: palette.textTertiary, marginTop: spacing.lg },
          ]}
        >
          By continuing you agree to the terms and privacy policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1 },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 12,
    fontFamily: 'Inter_500Medium',
  },
  headline: {
    fontSize: 40,
    lineHeight: 46,
    fontFamily: 'Fraunces_600SemiBold',
    letterSpacing: -0.5,
  },
  sub: { fontSize: 16, lineHeight: 22, fontFamily: 'Inter_400Regular' },
  primary: { alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  footer: { fontSize: 12, textAlign: 'center', fontFamily: 'Inter_400Regular' },
});
