import React from 'react';
import { View, Platform } from 'react-native';
import { Tabs } from 'expo-router';
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
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        headerStyle: {
          backgroundColor: palette.bg,
          borderBottomWidth: 0,
        },
        headerTitleStyle: {
          color: palette.textPrimary,
          fontFamily: 'Fraunces_600SemiBold',
          fontSize: 22,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, focused }) => (
            <ChecklistIcon color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: 'Projects',
          tabBarIcon: ({ color, focused }) => (
            <FolderIcon color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <PersonIcon color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

function ChecklistIcon({ color, focused }: { color: string; focused: boolean }) {
  const stroke = focused ? 2.2 : 1.8;
  return (
    <View
      style={{
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 18,
          height: 20,
          borderRadius: 4,
          borderWidth: stroke,
          borderColor: color,
          padding: 3,
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <View
            style={{
              width: 3,
              height: 3,
              borderRadius: 1,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              flex: 1,
              height: 2,
              backgroundColor: color,
              borderRadius: 1,
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <View
            style={{
              width: 3,
              height: 3,
              borderRadius: 1,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              flex: 1,
              height: 2,
              backgroundColor: color,
              borderRadius: 1,
            }}
          />
        </View>
      </View>
    </View>
  );
}

function FolderIcon({ color, focused }: { color: string; focused: boolean }) {
  const stroke = focused ? 2.2 : 1.8;
  return (
    <View
      style={{
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 20,
          height: 16,
          borderRadius: 3,
          borderWidth: stroke,
          borderColor: color,
          marginTop: 2,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 3,
          left: 2,
          width: 8,
          height: 3,
          borderTopLeftRadius: 2,
          borderTopRightRadius: 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

function PersonIcon({ color, focused }: { color: string; focused: boolean }) {
  const stroke = focused ? 2.2 : 1.8;
  return (
    <View
      style={{
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          borderWidth: stroke,
          borderColor: color,
          position: 'absolute',
          top: 1,
        }}
      />
      <View
        style={{
          width: 20,
          height: 11,
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
          borderWidth: stroke,
          borderBottomWidth: 0,
          borderColor: color,
        }}
      />
    </View>
  );
}
