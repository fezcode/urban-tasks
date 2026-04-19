import React from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { CheckSquare, FolderKanban, LayoutDashboard, User } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';

export default function AppTabs() {
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
