import React from 'react';
import { Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

type Tone = 'neutral' | 'accent' | 'active' | 'warning' | 'danger';

interface Props {
  label: string;
  tone?: Tone;
  selected?: boolean;
  onPress?: () => void;
  leftIcon?: React.ReactNode;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export const Chip: React.FC<Props> = ({
  label,
  tone = 'neutral',
  selected,
  onPress,
  leftIcon,
  size = 'md',
  style,
}) => {
  const { palette, radii, fontSize } = useTheme();

  const tones: Record<Tone, { bg: string; fg: string; border: string }> = {
    neutral: {
      bg: selected ? palette.surface : palette.bgSecondary,
      fg: selected ? palette.textPrimary : palette.textSecondary,
      border: selected ? palette.border : 'transparent',
    },
    accent: {
      bg: palette.accentLight,
      fg: palette.accent,
      border: selected ? palette.accent : 'transparent',
    },
    active: {
      bg: palette.statusActiveBg,
      fg: palette.statusActive,
      border: 'transparent',
    },
    warning: {
      bg: palette.statusWarningBg,
      fg: palette.statusWarning,
      border: 'transparent',
    },
    danger: {
      bg: palette.dangerBg,
      fg: palette.danger,
      border: 'transparent',
    },
  };

  const t = tones[tone];
  const paddingV = size === 'sm' ? 3 : 6;
  const paddingH = size === 'sm' ? 8 : 12;
  const fontS = size === 'sm' ? fontSize['2xs'] : fontSize.xs;

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: t.bg,
        borderColor: t.border,
        borderWidth: 1,
        borderRadius: radii.pill,
        paddingVertical: paddingV,
        paddingHorizontal: paddingH,
      }}
    >
      {leftIcon}
      <Text
        style={{
          color: t.fg,
          fontSize: fontS,
          fontFamily: 'Inter_500Medium',
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
    </View>
  );

  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={style}>
      {content}
    </TouchableOpacity>
  );
};
