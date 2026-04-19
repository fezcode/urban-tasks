import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, CalendarClock, Flag, Hash, Search, X } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { api, Project, Task } from '@/api/client';
import { EmptyState } from '@/components/ui';

type Row =
  | { kind: 'tag'; tag: string; count: number }
  | { kind: 'task'; task: Task; project?: Project };

export default function SearchScreen() {
  const { palette, radii, spacing, fontSize } = useTheme();
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [t, p] = await Promise.all([api.listTasks(), api.listProjects()]);
        setTasks(t);
        setProjects(p);
      } finally {
        setLoading(false);
      }
    })();
    const id = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(id);
  }, []);

  const tagMap = useMemo(() => {
    const m = new Map<string, number>();
    tasks.forEach((t) => t.tags?.forEach((tag) => m.set(tag, (m.get(tag) ?? 0) + 1)));
    return m;
  }, [tasks]);

  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const tagMode = q.startsWith('@');
    const term = tagMode ? q.slice(1) : q;

    const out: Row[] = [];
    if (tagMode || !q) {
      [...tagMap.entries()]
        .filter(([tag]) => (term ? tag.toLowerCase().includes(term) : true))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .forEach(([tag, count]) => out.push({ kind: 'tag', tag, count }));
    }

    if (!tagMode) {
      const projById = new Map(projects.map((p) => [p.id, p]));
      const matches = (t: Task) => {
        if (!term) return true;
        if (t.title.toLowerCase().includes(term)) return true;
        if (t.body?.toLowerCase().includes(term)) return true;
        if (t.tags?.some((tag) => tag.toLowerCase().includes(term))) return true;
        return false;
      };
      tasks
        .filter(matches)
        .slice(0, 40)
        .forEach((task) => out.push({ kind: 'task', task, project: projById.get(task.projectId) }));
    }
    return out;
  }, [query, tasks, projects, tagMap]);

  const onPickTag = (tag: string) => setQuery('@' + tag);
  const onPickTask = (task: Task) => {
    router.back();
    // Defer so the tasks screen is focused before we emit a deep link (future work).
    // For now just return — user sees the task in the refreshed list.
    void task;
  };

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: palette.bg }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderBottomColor: palette.borderLight,
          borderBottomWidth: 1,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={22} color={palette.textPrimary} />
        </TouchableOpacity>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            backgroundColor: palette.surface,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: palette.border,
            paddingHorizontal: spacing.md,
          }}
        >
          <Search size={16} color={palette.textTertiary} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search tasks, @tags…"
            placeholderTextColor={palette.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              flex: 1,
              paddingVertical: Platform.OS === 'ios' ? spacing.sm + 2 : spacing.sm,
              color: palette.textPrimary,
              fontFamily: 'Inter_400Regular',
              fontSize: 15,
              ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
            }}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <X size={16} color={palette.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r, i) =>
            r.kind === 'tag' ? `tag:${r.tag}` : `task:${r.task.id}:${i}`
          }
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            gap: spacing.xs,
          }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              icon={Search}
              title={query.trim() ? 'No matches' : 'Start typing'}
              description={
                query.trim()
                  ? 'Try a different word, or prefix with @ to search tags.'
                  : 'Find tasks by title, notes, or @tag.'
              }
            />
          }
          renderItem={({ item }) =>
            item.kind === 'tag' ? (
              <TouchableOpacity
                onPress={() => onPickTag(item.tag)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingVertical: spacing.sm + 2,
                  paddingHorizontal: spacing.md,
                  borderRadius: radii.md,
                  backgroundColor: palette.surface,
                  borderWidth: 1,
                  borderColor: palette.border,
                }}
              >
                <Hash size={14} color={palette.accent} />
                <Text
                  style={{
                    flex: 1,
                    color: palette.textPrimary,
                    fontFamily: 'Inter_500Medium',
                    fontSize: fontSize.sm,
                  }}
                >
                  {item.tag}
                </Text>
                <Text
                  style={{
                    color: palette.textTertiary,
                    fontFamily: 'Inter_400Regular',
                    fontSize: fontSize.xs,
                  }}
                >
                  {item.count}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => onPickTask(item.task)}
                activeOpacity={0.7}
                style={{
                  paddingVertical: spacing.sm + 2,
                  paddingHorizontal: spacing.md,
                  borderRadius: radii.md,
                  backgroundColor: palette.surface,
                  borderWidth: 1,
                  borderColor: palette.border,
                  gap: 4,
                }}
              >
                <Text
                  style={{
                    color: palette.textPrimary,
                    fontFamily: 'Inter_500Medium',
                    fontSize: fontSize.sm,
                  }}
                  numberOfLines={1}
                >
                  {item.task.title}
                </Text>
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}
                >
                  {item.project && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <View
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: item.project.color ?? palette.textTertiary,
                        }}
                      />
                      <Text
                        style={{
                          color: palette.textTertiary,
                          fontFamily: 'Inter_400Regular',
                          fontSize: fontSize['2xs'],
                        }}
                      >
                        {item.project.name}
                      </Text>
                    </View>
                  )}
                  {item.task.priority && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Flag size={11} color={palette.textTertiary} />
                      <Text
                        style={{
                          color: palette.textTertiary,
                          fontFamily: 'Inter_400Regular',
                          fontSize: fontSize['2xs'],
                          textTransform: 'capitalize',
                        }}
                      >
                        {item.task.priority}
                      </Text>
                    </View>
                  )}
                  {item.task.dueDate && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <CalendarClock size={11} color={palette.textTertiary} />
                      <Text
                        style={{
                          color: palette.textTertiary,
                          fontFamily: 'Inter_400Regular',
                          fontSize: fontSize['2xs'],
                        }}
                      >
                        {item.task.dueDate.slice(0, 10)}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}
