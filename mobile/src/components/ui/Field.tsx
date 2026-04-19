import React from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

interface Props {
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
  style?: ViewStyle;
}

export const Field: React.FC<Props> = ({ label, children, hint, error, style }) => {
  const { palette, spacing, fontSize } = useTheme();
  return (
    <View style={[{ gap: spacing.sm }, style]}>
      <Text
        style={{
          color: palette.textTertiary,
          fontSize: fontSize['2xs'],
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          fontFamily: 'Inter_500Medium',
        }}
      >
        {label}
      </Text>
      {children}
      {(hint || error) && (
        <Text
          style={{
            color: error ? palette.danger : palette.textTertiary,
            fontSize: fontSize.xs,
            fontFamily: 'Inter_400Regular',
          }}
        >
          {error ?? hint}
        </Text>
      )}
    </View>
  );
};
