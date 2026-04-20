import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  FlatList,
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, Feather, LucideIcon, Sparkles, Target } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { getToken } from '@/api/client';

interface Slide {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    icon: Feather,
    eyebrow: 'welcome',
    title: 'The quiet place\nfor loud to-dos.',
    body: 'A calm, editorial task manager. No streaks, no nagging, no dopamine loops — just the list you meant to write.',
  },
  {
    icon: Target,
    eyebrow: 'clarity',
    title: 'One clear next\nthing to do.',
    body: 'Group by priority, filter by tag, look at just today. Your dashboard surfaces what actually matters.',
  },
  {
    icon: Sparkles,
    eyebrow: 'everywhere',
    title: 'Web, mobile,\nsynced.',
    body: 'Same account across every device. Export your data whenever you like — it belongs to you.',
  },
];

export default function Landing() {
  const { palette, radii, spacing, fontSize } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);

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

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };

  const next = () => {
    if (index < SLIDES.length - 1) {
      const target = index + 1;
      listRef.current?.scrollToOffset({ offset: target * width, animated: true });
      setIndex(target);
    } else {
      router.push('/login');
    }
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: palette.bg }]}>
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
          }}
        >
          <Pressable
            onPress={() => router.push('/login')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
          >
            <Text
              style={{
                color: palette.textTertiary,
                fontFamily: 'Inter_500Medium',
                fontSize: fontSize.sm,
              }}
            >
              Skip
            </Text>
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(s) => s.title}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          onScrollEndDrag={onScroll}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          renderItem={({ item }) => (
            <View style={{ width, paddingHorizontal: spacing.xl, flex: 1, justifyContent: 'center' }}>
              <View
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 44,
                  backgroundColor: palette.accentLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing.xl,
                }}
              >
                <item.icon size={36} color={palette.accent} strokeWidth={1.5} />
              </View>
              <Text
                style={{
                  color: palette.textTertiary,
                  fontFamily: 'Inter_500Medium',
                  fontSize: 12,
                  letterSpacing: 4,
                  textTransform: 'uppercase',
                  marginBottom: spacing.md,
                }}
              >
                {item.eyebrow}
              </Text>
              <Text
                style={{
                  color: palette.textPrimary,
                  fontFamily: 'Fraunces_600SemiBold',
                  fontSize: 36,
                  lineHeight: 42,
                  letterSpacing: -0.5,
                  marginBottom: spacing.md,
                }}
              >
                {item.title}
              </Text>
              <Text
                style={{
                  color: palette.textSecondary,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 16,
                  lineHeight: 24,
                }}
              >
                {item.body}
              </Text>
            </View>
          )}
        />

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
            marginBottom: spacing.lg,
          }}
        >
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === index ? 22 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === index ? palette.accent : palette.border,
              }}
            />
          ))}
        </View>

        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
          <Pressable
            onPress={next}
            accessibilityRole="button"
            accessibilityLabel={index < SLIDES.length - 1 ? 'Next' : 'Get started'}
            style={({ pressed }) => [
              styles.primary,
              {
                backgroundColor: palette.textPrimary,
                borderRadius: radii.pill,
                opacity: pressed ? 0.9 : 1,
                paddingVertical: spacing.md + 2,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.sm,
              },
            ]}
          >
            <Text
              style={{
                color: palette.bg,
                fontSize: 16,
                fontFamily: 'Inter_600SemiBold',
              }}
            >
              {index < SLIDES.length - 1 ? 'Next' : 'Get started'}
            </Text>
            <ArrowRight size={18} color={palette.bg} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  primary: { alignItems: 'center', justifyContent: 'center' },
});
