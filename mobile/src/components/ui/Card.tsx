import React from 'react';
import { View, ViewStyle, TouchableOpacity } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  elevated?: boolean;
  padded?: boolean;
  style?: ViewStyle;
}

export const Card: React.FC<Props> = ({ children, onPress, elevated, padded = true, style }) => {
  const { palette, radii, spacing, shadow } = useTheme();
  const base: ViewStyle = {
    backgroundColor: elevated ? palette.surfaceRaised : palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: padded ? spacing.md : 0,
    ...(elevated ? shadow.sm : null),
  };

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[base, style]}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[base, style]}>{children}</View>;
};
