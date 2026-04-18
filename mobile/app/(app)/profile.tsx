import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { api, clearToken, User } from '@/api/client';

export default function Profile() {
  const { palette, radii, spacing, mode, toggle } = useTheme();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setUser(await api.me());
      } catch {
        // ignore — could be offline
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signOut = async () => {
    await clearToken();
    router.replace('/');
  };

  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.flex, { backgroundColor: palette.bg }]}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <View style={{ alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: palette.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: palette.textInverse,
                fontSize: 32,
                fontFamily: 'Fraunces_600SemiBold',
              }}
            >
              {initial}
            </Text>
          </View>
          {loading ? (
            <ActivityIndicator color={palette.accent} />
          ) : (
            <>
              <Text
                style={{
                  color: palette.textPrimary,
                  fontSize: 20,
                  fontFamily: 'Fraunces_600SemiBold',
                }}
              >
                {user?.name || 'Signed in'}
              </Text>
              {user?.email && (
                <Text
                  style={{
                    color: palette.textSecondary,
                    fontSize: 14,
                    fontFamily: 'Inter_400Regular',
                    marginTop: -spacing.sm,
                  }}
                >
                  {user.email}
                </Text>
              )}
            </>
          )}
        </View>

        <View style={{ gap: spacing.sm }}>
          <Row label="Theme" value={mode === 'dark' ? 'Dark' : 'Light'} onPress={toggle} />
          <Row label="Sign out" value="" destructive onPress={signOut} />
        </View>
      </ScrollView>

      <Text
        style={{
          textAlign: 'center',
          color: palette.textTertiary,
          fontFamily: 'Fraunces_400Regular',
          fontSize: 13,
          paddingBottom: spacing.xl,
        }}
      >
        urban tasks · mobile
      </Text>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  onPress,
  destructive,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const { palette, radii, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderWidth: 1,
          borderRadius: radii.lg,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: destructive ? palette.danger : palette.textPrimary,
          fontSize: 15,
          fontFamily: 'Inter_500Medium',
        }}
      >
        {label}
      </Text>
      {value ? (
        <Text
          style={{ color: palette.textSecondary, fontFamily: 'Inter_400Regular' }}
        >
          {value}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
