import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'neutral' | 'accent' | 'danger';
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  tone = 'neutral',
}: EmptyStateProps) {
  const { palette, radii, spacing, fontSize } = useTheme();
  const accent =
    tone === 'accent' ? palette.accent : tone === 'danger' ? palette.danger : palette.textTertiary;
  const bg =
    tone === 'accent'
      ? palette.accentLight
      : tone === 'danger'
        ? palette.dangerBg
        : palette.surface;

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.xl * 1.5,
        gap: spacing.md,
      }}
    >
      {Icon && (
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={32} color={accent} strokeWidth={1.5} />
        </View>
      )}
      <Text
        style={{
          color: palette.textPrimary,
          fontFamily: 'Fraunces_500Medium',
          fontSize: fontSize.xl,
          textAlign: 'center',
          marginTop: spacing.xs,
        }}
      >
        {title}
      </Text>
      {description && (
        <Text
          style={{
            color: palette.textTertiary,
            fontFamily: 'Inter_400Regular',
            fontSize: fontSize.sm,
            textAlign: 'center',
            lineHeight: 20,
            maxWidth: 300,
          }}
        >
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <TouchableOpacity
          onPress={onAction}
          activeOpacity={0.85}
          style={{
            marginTop: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm + 2,
            borderRadius: radii.pill,
            backgroundColor: palette.textPrimary,
          }}
        >
          <Text
            style={{
              color: palette.bg,
              fontFamily: 'Inter_600SemiBold',
              fontSize: fontSize.sm,
              letterSpacing: 0.2,
            }}
          >
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
