import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { api, Project, Task } from '@/api/client';
import { EmptyState } from '@/components/ui';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export default function CalendarScreen() {
  const { palette, radii, spacing, fontSize } = useTheme();
  const router = useRouter();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<Date | null>(() => startOfDay(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [t, p] = await Promise.all([api.listTasks(), api.listProjects()]);
      setTasks(t);
      setProjects(p);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay()); // back to Sunday
    const out: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(d);
    }
    return out;
  }, [cursor]);

  const tasksByDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const k = key(new Date(t.dueDate));
      const arr = m.get(k) ?? [];
      arr.push(t);
      m.set(k, arr);
    }
    return m;
  }, [tasks]);

  const selectedTasks = selected ? tasksByDay.get(key(selected)) ?? [] : [];
  const today = startOfDay(new Date());
  const projById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const shiftMonth = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
        }}
      >
        <Text
          style={{
            color: palette.textPrimary,
            fontFamily: 'Fraunces_600SemiBold',
            fontSize: 22,
          }}
        >
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <TouchableOpacity
            onPress={() => shiftMonth(-1)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            style={{ padding: 6 }}
          >
            <ChevronLeft size={20} color={palette.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              const n = new Date();
              setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
              setSelected(startOfDay(n));
            }}
            hitSlop={8}
            style={{
              paddingHorizontal: spacing.sm,
              paddingVertical: 4,
              borderRadius: radii.pill,
              borderWidth: 1,
              borderColor: palette.border,
            }}
          >
            <Text
              style={{
                color: palette.textSecondary,
                fontSize: 12,
                fontFamily: 'Inter_500Medium',
              }}
            >
              Today
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => shiftMonth(1)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Next month"
            style={{ padding: 6 }}
          >
            <ChevronRight size={20} color={palette.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={{ paddingHorizontal: spacing.md }}>
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              {DOW.map((d, i) => (
                <View key={i} style={{ flex: 1, paddingVertical: 6 }}>
                  <Text
                    style={{
                      textAlign: 'center',
                      color: palette.textTertiary,
                      fontSize: 10,
                      letterSpacing: 1.2,
                      fontFamily: 'Inter_500Medium',
                    }}
                  >
                    {d}
                  </Text>
                </View>
              ))}
            </View>
            <View
              style={{
                borderRadius: radii.lg,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: palette.border,
                backgroundColor: palette.border,
              }}
            >
              {Array.from({ length: 6 }).map((_, rowIdx) => (
                <View key={rowIdx} style={{ flexDirection: 'row' }}>
                  {days.slice(rowIdx * 7, rowIdx * 7 + 7).map((d, i) => {
                    const inMonth = d.getMonth() === cursor.getMonth();
                    const isToday = sameDay(d, today);
                    const isSelected = selected ? sameDay(d, selected) : false;
                    const items = tasksByDay.get(key(d)) ?? [];
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={() => setSelected(startOfDay(d))}
                        activeOpacity={0.7}
                        style={{
                          flex: 1,
                          minHeight: 62,
                          backgroundColor: isSelected ? palette.accentLight : palette.bg,
                          padding: 5,
                          opacity: inMonth ? 1 : 0.35,
                          borderWidth: isSelected ? 1.5 : 0,
                          borderColor: palette.accent,
                        }}
                      >
                        <View
                          style={{
                            alignSelf: 'flex-start',
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isToday ? palette.accent : 'transparent',
                          }}
                        >
                          <Text
                            style={{
                              color: isToday
                                ? palette.textInverse
                                : isSelected
                                  ? palette.accent
                                  : palette.textSecondary,
                              fontSize: 11,
                              fontFamily: 'Inter_600SemiBold',
                            }}
                          >
                            {d.getDate()}
                          </Text>
                        </View>
                        {items.length > 0 && (
                          <View
                            style={{
                              flexDirection: 'row',
                              gap: 2,
                              marginTop: 4,
                              flexWrap: 'wrap',
                            }}
                          >
                            {items.slice(0, 3).map((t) => {
                              const p = projById.get(t.projectId);
                              return (
                                <View
                                  key={t.id}
                                  style={{
                                    width: 5,
                                    height: 5,
                                    borderRadius: 2.5,
                                    backgroundColor:
                                      t.status === 'done'
                                        ? palette.textTertiary
                                        : (p?.color ?? palette.accent),
                                  }}
                                />
                              );
                            })}
                            {items.length > 3 && (
                              <Text
                                style={{
                                  fontSize: 8,
                                  color: palette.textTertiary,
                                  fontFamily: 'Inter_500Medium',
                                }}
                              >
                                +{items.length - 3}
                              </Text>
                            )}
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>

          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
            <Text
              style={{
                color: palette.textPrimary,
                fontFamily: 'Fraunces_600SemiBold',
                fontSize: 18,
              }}
            >
              {selected
                ? selected.toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Select a day'}
            </Text>
            <Text
              style={{
                color: palette.textTertiary,
                fontFamily: 'Inter_400Regular',
                fontSize: 12,
                marginTop: 2,
              }}
            >
              {selected
                ? `${selectedTasks.length} task${selectedTasks.length === 1 ? '' : 's'} due`
                : 'Tap a date above.'}
            </Text>
          </View>

          <View style={{ padding: spacing.lg, gap: spacing.sm }}>
            {selected && selectedTasks.length === 0 ? (
              <EmptyState title="Nothing due" description="A quiet day. Maybe plan tomorrow?" />
            ) : (
              selectedTasks.map((t) => {
                const p = projById.get(t.projectId);
                const done = t.status === 'done';
                return (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() =>
                      router.push({ pathname: '/tasks', params: { open: t.id } } as any)
                    }
                    activeOpacity={0.7}
                    style={{
                      padding: spacing.md,
                      borderRadius: radii.md,
                      backgroundColor: palette.surface,
                      borderWidth: 1,
                      borderColor: palette.border,
                    }}
                  >
                    <Text
                      style={{
                        color: done ? palette.textTertiary : palette.textPrimary,
                        fontFamily: 'Inter_500Medium',
                        fontSize: fontSize.sm,
                        textDecorationLine: done ? 'line-through' : 'none',
                      }}
                    >
                      {t.title}
                    </Text>
                    {p && (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          marginTop: 4,
                        }}
                      >
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: p.color ?? palette.textTertiary,
                          }}
                        />
                        <Text
                          style={{
                            color: palette.textTertiary,
                            fontSize: fontSize['2xs'],
                            fontFamily: 'Inter_400Regular',
                          }}
                        >
                          {p.name}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
