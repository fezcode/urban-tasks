import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

interface Props {
  vertical?: boolean;
  inset?: number;
  style?: ViewStyle;
}

export const Divider: React.FC<Props> = ({ vertical, inset = 0, style }) => {
  const { palette } = useTheme();
  if (vertical) {
    return (
      <View
        style={[
          { width: 1, alignSelf: 'stretch', backgroundColor: palette.borderLight, marginVertical: inset },
          style,
        ]}
      />
    );
  }
  return (
    <View
      style={[
        { height: 1, alignSelf: 'stretch', backgroundColor: palette.borderLight, marginHorizontal: inset },
        style,
      ]}
    />
  );
};
