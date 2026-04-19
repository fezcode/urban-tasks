import React from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

interface Props {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  style?: ViewStyle;
}

export const SectionHeader: React.FC<Props> = ({ title, subtitle, right, style }) => {
  const { palette, spacing, fontSize } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.sm,
          gap: spacing.md,
        },
        style,
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            color: palette.textPrimary,
            fontSize: fontSize.xl,
            fontFamily: 'Fraunces_600SemiBold',
          }}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            style={{
              color: palette.textTertiary,
              fontSize: fontSize.xs,
              fontFamily: 'Inter_400Regular',
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
};
