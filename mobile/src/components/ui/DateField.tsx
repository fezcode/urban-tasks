import React, { useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarClock, X } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';

interface Props {
  value?: string;
  onChange: (iso: string | undefined) => void;
  placeholder?: string;
}

function formatDisplay(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const DateField: React.FC<Props> = ({ value, onChange, placeholder = 'Pick a date' }) => {
  const { palette, radii, spacing, fontSize } = useTheme();
  const [showPicker, setShowPicker] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderWidth: 1,
          borderRadius: radii.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          gap: spacing.sm,
        }}
      >
        <CalendarClock size={16} color={palette.textTertiary} />
        {/* @ts-ignore web-only native input */}
        <input
          type="date"
          value={value ? value.slice(0, 10) : ''}
          onChange={(e: any) => onChange(e.target.value || undefined)}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: palette.textPrimary,
            fontFamily: 'Inter_400Regular',
            fontSize: fontSize.md,
            padding: 6,
          }}
        />
        {value && (
          <TouchableOpacity onPress={() => onChange(undefined)} hitSlop={8}>
            <X size={16} color={palette.textTertiary} />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const handleChange = (_: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) onChange(selected.toISOString().slice(0, 10));
  };

  return (
    <View>
      <TouchableOpacity
        onPress={() => setShowPicker(true)}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: palette.surface,
          borderColor: palette.border,
          borderWidth: 1,
          borderRadius: radii.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          gap: spacing.sm,
        }}
      >
        <CalendarClock size={16} color={palette.textTertiary} />
        <Text
          style={{
            flex: 1,
            color: value ? palette.textPrimary : palette.textTertiary,
            fontFamily: 'Inter_400Regular',
            fontSize: fontSize.md,
          }}
        >
          {value ? formatDisplay(value) : placeholder}
        </Text>
        {value && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation?.();
              onChange(undefined);
            }}
            hitSlop={8}
          >
            <X size={16} color={palette.textTertiary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
      {showPicker && (
        <DateTimePicker
          value={value ? new Date(value) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleChange}
        />
      )}
      {Platform.OS === 'ios' && showPicker && (
        <TouchableOpacity
          onPress={() => setShowPicker(false)}
          style={{ alignSelf: 'flex-end', paddingVertical: spacing.sm }}
        >
          <Text style={{ color: palette.accent, fontFamily: 'Inter_500Medium' }}>Done</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
