import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<Props> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  leftIcon,
  rightIcon,
  fullWidth,
  style,
}) => {
  const { palette, radii, fontSize } = useTheme();

  const sizes: Record<Size, { paddingV: number; paddingH: number; font: number }> = {
    sm: { paddingV: 7, paddingH: 12, font: fontSize.sm },
    md: { paddingV: 11, paddingH: 16, font: fontSize.base },
    lg: { paddingV: 14, paddingH: 20, font: fontSize.md },
  };

  const variants: Record<Variant, { bg: string; color: string; border: string }> = {
    primary: { bg: palette.accent, color: palette.textInverse, border: palette.accent },
    secondary: { bg: palette.surface, color: palette.textPrimary, border: palette.border },
    ghost: { bg: 'transparent', color: palette.textSecondary, border: 'transparent' },
    danger: { bg: palette.danger, color: '#fff', border: palette.danger },
  };

  const s = sizes[size];
  const v = variants[variant];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          borderWidth: 1,
          borderRadius: radii.md,
          paddingVertical: s.paddingV,
          paddingHorizontal: s.paddingH,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: isDisabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.color} size="small" />
      ) : (
        <>
          {leftIcon && <View>{leftIcon}</View>}
          <Text
            style={{
              color: v.color,
              fontSize: s.font,
              fontFamily: 'Inter_500Medium',
              letterSpacing: 0.2,
            }}
          >
            {title}
          </Text>
          {rightIcon && <View>{rightIcon}</View>}
        </>
      )}
    </TouchableOpacity>
  );
};
