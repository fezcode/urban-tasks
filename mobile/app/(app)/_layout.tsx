import React, { useEffect, useState } from 'react';
import { AppState, Platform, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { CalendarDays, CheckSquare, CloudOff, FolderKanban, LayoutDashboard, User } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { flushQueue, onQueueChange } from '@/api/client';
import { queueSize } from '@/api/offlineQueue';

function OfflineBanner() {
  const { palette, spacing, fontSize } = useTheme();
  const [count, setCount] = useState(0);

  useEffect(() => {
    queueSize().then(setCount);
    const off = onQueueChange(setCount);
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    const attempt = () => {
      flushQueue().catch(() => {});
    };
    attempt();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') attempt();
    });
    const id = setInterval(attempt, 15000);
    return () => {
      sub.remove();
      clearInterval(id);
    };
  }, []);

  if (count <= 0) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 100 : 84,
        left: spacing.md,
        right: spacing.md,
        backgroundColor: palette.surface,
        borderWidth: 1,
        borderColor: palette.borderLight,
        borderRadius: 999,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        zIndex: 10,
      }}
    >
      <CloudOff size={14} color={palette.textSecondary} />
      <Text
        style={{
          color: palette.textSecondary,
          fontFamily: 'Inter_500Medium',
          fontSize: fontSize.sm,
        }}
      >
        {count} pending {count === 1 ? 'change' : 'changes'} — will sync
      </Text>
    </View>
  );
}

export default function AppTabs() {
  const { palette } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <OfflineBanner />
      <InnerTabs />
    </View>
  );
}

function InnerTabs() {
  const { palette } = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.textTertiary,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.borderLight,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 72,
          paddingTop: 10,
          paddingBottom: Platform.OS === 'ios' ? 26 : 14,
        },
        tabBarLabelStyle: {
          fontFamily: 'Inter_500Medium',
          fontSize: 12,
          letterSpacing: 0.3,
          marginTop: 4,
        },
        tabBarItemStyle: { paddingVertical: 4 },
        headerStyle: { backgroundColor: palette.bg, borderBottomWidth: 0 },
        headerTitleStyle: {
          color: palette.textPrimary,
          fontFamily: 'Fraunces_600SemiBold',
          fontSize: 22,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <LayoutDashboard color={color} size={22} strokeWidth={focused ? 2.2 : 1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, focused }) => (
            <CheckSquare color={color} size={22} strokeWidth={focused ? 2.2 : 1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, focused }) => (
            <CalendarDays color={color} size={22} strokeWidth={focused ? 2.2 : 1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: 'Projects',
          tabBarIcon: ({ color, focused }) => (
            <FolderKanban color={color} size={22} strokeWidth={focused ? 2.2 : 1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <User color={color} size={22} strokeWidth={focused ? 2.2 : 1.8} />
          ),
        }}
      />
      <Tabs.Screen name="search" options={{ href: null }} />
    </Tabs>
  );
}

export { OfflineBanner };
