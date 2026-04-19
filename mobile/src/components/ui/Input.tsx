import React, { forwardRef } from 'react';
import { TextInput, TextInputProps, ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

interface Props extends TextInputProps {
  multiline?: boolean;
  containerStyle?: ViewStyle;
}

export const Input = forwardRef<TextInput, Props>(
  ({ multiline, style, containerStyle, ...rest }, ref) => {
    const { palette, radii, spacing, fontSize } = useTheme();
    return (
      <TextInput
        ref={ref}
        multiline={multiline}
        placeholderTextColor={palette.textTertiary}
        style={[
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderWidth: 1,
            borderRadius: radii.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            fontSize: fontSize.md,
            color: palette.textPrimary,
            fontFamily: 'Inter_400Regular',
            minHeight: multiline ? 96 : undefined,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          style,
        ]}
        {...rest}
      />
    );
  }
);
Input.displayName = 'Input';
