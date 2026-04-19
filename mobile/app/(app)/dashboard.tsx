import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Flag,
  Flame,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { api, Task } from '@/api/client';
import { EmptyState } from '@/components/ui';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function daysBetween(a: Date, b: Date) {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000);
}

export default function DashboardScreen() {
  const { palette, radii, spacing, fontSize, shadow } = useTheme();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.listTasks();
      setTasks(list);
    } finally {
      setLoading(false);
      setRefreshing(false);
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

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    const active = tasks.filter((t) => t.status === 'in-progress').length;
    const todo = tasks.filter((t) => t.status === 'todo').length;
    const today = new Date();
    const overdue = tasks.filter(
      (t) => t.status !== 'done' && t.dueDate && daysBetween(new Date(t.dueDate), today) < 0,
    );
    const dueToday = tasks.filter(
      (t) => t.status !== 'done' && t.dueDate && daysBetween(new Date(t.dueDate), today) === 0,
    );
    const dueThisWeek = tasks
      .filter((t) => {
        if (t.status === 'done' || !t.dueDate) return false;
        const diff = daysBetween(new Date(t.dueDate), today);
        return diff > 0 && diff <= 7;
      })
      .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));
    const highPriority = tasks.filter((t) => t.status !== 'done' && t.priority === 'high');
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, active, todo, overdue, dueToday, dueThisWeek, highPriority, completionRate };
  }, [tasks]);

  if (loading) {
    return (
      <SafeAreaView
        edges={['bottom']}
        style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}
      >
        <ActivityIndicator color={palette.accent} />
      </SafeAreaView>
    );
  }

  const StatCard: React.FC<{
    label: string;
    value: React.ReactNode;
    hint?: string;
    icon?: React.ReactNode;
    tone?: 'neutral' | 'accent' | 'danger' | 'active' | 'warning';
    onPress?: () => void;
  }> = ({ label, value, hint, icon, tone = 'neutral', onPress }) => {
    const toneColors: Record<string, { fg: string; bg: string; border: string }> = {
      neutral: { fg: palette.textPrimary, bg: palette.surface, border: palette.border },
      accent: { fg: palette.accent, bg: palette.accentLight, border: palette.accent + '55' },
      danger: { fg: palette.danger, bg: palette.dangerBg, border: palette.danger + '55' },
      active: { fg: palette.statusActive, bg: palette.statusActiveBg, border: palette.statusActive + '55' },
      warning: { fg: palette.statusWarning, bg: palette.statusWarningBg, border: palette.statusWarning + '55' },
    };
    const c = toneColors[tone];
    const Wrapper: any = onPress ? TouchableOpacity : View;
    return (
      <Wrapper
        onPress={onPress}
        activeOpacity={0.85}
        style={{
          flex: 1,
          backgroundColor: c.bg,
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: radii.lg,
          padding: spacing.md,
          gap: 6,
          ...shadow.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {icon}
          <Text
            style={{
              color: c.fg,
              fontSize: fontSize['2xs'],
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              fontFamily: 'Inter_600SemiBold',
            }}
          >
            {label}
          </Text>
        </View>
        <Text
          style={{
            color: palette.textPrimary,
            fontSize: 28,
            fontFamily: 'Fraunces_600SemiBold',
            letterSpacing: -0.5,
          }}
        >
          {value}
        </Text>
        {hint && (
          <Text
            style={{
              color: palette.textTertiary,
              fontSize: fontSize.xs,
              fontFamily: 'Inter_400Regular',
            }}
          >
            {hint}
          </Text>
        )}
      </Wrapper>
    );
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: 120,
          gap: spacing.md,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={palette.accent}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        <View style={{ gap: 4 }}>
          <Text
            style={{
              color: palette.textTertiary,
              fontSize: fontSize['2xs'],
              letterSpacing: 3,
              textTransform: 'uppercase',
              fontFamily: 'Inter_500Medium',
            }}
          >
            A quick read
          </Text>
          <Text
            style={{
              color: palette.textPrimary,
              fontFamily: 'Fraunces_600SemiBold',
              fontSize: 26,
              letterSpacing: -0.5,
            }}
          >
            Today's shape.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <StatCard
            label="Open"
            value={stats.todo + stats.active}
            hint={`${stats.active} in progress`}
            icon={<Zap size={13} color={palette.accent} />}
          />
          <StatCard
            label="Done"
            value={stats.done}
            hint={`${stats.completionRate}% of total`}
            tone="active"
            icon={<CheckCircle2 size={13} color={palette.statusActive} />}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <StatCard
            label="Overdue"
            value={stats.overdue.length}
            hint={stats.overdue.length === 0 ? 'All caught up' : 'Need attention'}
            tone={stats.overdue.length > 0 ? 'danger' : 'neutral'}
            icon={
              <AlertTriangle
                size={13}
                color={stats.overdue.length > 0 ? palette.danger : palette.textTertiary}
              />
            }
          />
          <StatCard
            label="Due today"
            value={stats.dueToday.length}
            hint={stats.dueToday.length === 0 ? 'Nothing scheduled' : 'Focus here'}
            tone={stats.dueToday.length > 0 ? 'warning' : 'neutral'}
            icon={
              <CalendarClock
                size={13}
                color={stats.dueToday.length > 0 ? palette.statusWarning : palette.textTertiary}
              />
            }
          />
        </View>

        <View
          style={{
            backgroundColor: palette.surface,
            borderColor: palette.border,
            borderWidth: 1,
            borderRadius: radii.lg,
            padding: spacing.md,
            gap: spacing.sm,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Target size={14} color={palette.textSecondary} />
            <Text
              style={{
                color: palette.textSecondary,
                fontSize: fontSize['2xs'],
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                fontFamily: 'Inter_600SemiBold',
              }}
            >
              Completion
            </Text>
            <Text
              style={{
                marginLeft: 'auto',
                color: palette.textPrimary,
                fontFamily: 'Inter_600SemiBold',
                fontSize: fontSize.base,
              }}
            >
              {stats.completionRate}%
            </Text>
          </View>
          <View
            style={{
              height: 8,
              backgroundColor: palette.bgSecondary,
              borderRadius: 999,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${stats.completionRate}%`,
                height: '100%',
                backgroundColor: palette.statusActive,
              }}
            />
          </View>
          <Text
            style={{
              color: palette.textTertiary,
              fontSize: fontSize.xs,
              fontFamily: 'Inter_400Regular',
            }}
          >
            {stats.done} of {stats.total} tasks complete
          </Text>
        </View>

        {stats.highPriority.length > 0 && (
          <FocusList
            title="High priority"
            icon={<Flame size={14} color={palette.danger} />}
            tone={palette.danger}
            tasks={stats.highPriority.slice(0, 5)}
            onPress={() => router.push('/(app)/tasks')}
          />
        )}

        {stats.dueThisWeek.length > 0 && (
          <FocusList
            title="Due this week"
            icon={<CalendarClock size={14} color={palette.statusWarning} />}
            tone={palette.statusWarning}
            tasks={stats.dueThisWeek.slice(0, 5)}
            onPress={() => router.push('/(app)/tasks')}
          />
        )}

        {stats.total === 0 && (
          <EmptyState
            icon={Sparkles}
            tone="accent"
            title="A blank slate"
            description="Your dashboard lights up as you add tasks. Set a few to see what's due, what's hot, and what's done."
            actionLabel="Add your first task"
            onAction={() => router.push('/(app)/tasks')}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FocusList({
  title,
  icon,
  tone,
  tasks,
  onPress,
}: {
  title: string;
  icon: React.ReactNode;
  tone: string;
  tasks: Task[];
  onPress: () => void;
}) {
  const { palette, radii, spacing, fontSize } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderWidth: 1,
        borderRadius: radii.lg,
        padding: spacing.md,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon}
        <Text
          style={{
            color: tone,
            fontSize: fontSize['2xs'],
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            fontFamily: 'Inter_600SemiBold',
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            marginLeft: 'auto',
            color: palette.textTertiary,
            fontSize: fontSize.xs,
            fontFamily: 'Inter_400Regular',
          }}
        >
          {tasks.length}
        </Text>
      </View>
      <View style={{ gap: 4 }}>
        {tasks.map((t) => (
          <View
            key={t.id}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}
          >
            {t.priority === 'high' && <Flag size={11} color={palette.danger} />}
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                color: palette.textPrimary,
                fontSize: fontSize.sm,
                fontFamily: 'Inter_400Regular',
              }}
            >
              {t.title}
            </Text>
            {t.dueDate && (
              <Text
                style={{
                  color: palette.textTertiary,
                  fontSize: fontSize['2xs'],
                  fontFamily: 'Inter_500Medium',
                }}
              >
                {new Date(t.dueDate).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            )}
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}
