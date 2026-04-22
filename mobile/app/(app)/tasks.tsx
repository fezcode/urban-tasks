import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarClock, Check, Flag, Inbox, Pencil, Plus, Search, SearchX, Share2, X } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { api, friendlyErrorMessage, Task, Project, Member } from '@/api/client';
import { DateField, EmptyState, Markdown } from '@/components/ui';
import { haptic } from '@/haptics';

type Filter = 'all' | 'todo' | 'in-progress' | 'done';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'todo', label: 'To do' },
  { key: 'in-progress', label: 'Doing' },
  { key: 'done', label: 'Done' },
];

const STATUS_LABEL: Record<Task['status'], string> = {
  todo: 'To do',
  'in-progress': 'In progress',
  done: 'Done',
};

const nextStatus = (s: Task['status']): Task['status'] =>
  s === 'todo' ? 'in-progress' : s === 'in-progress' ? 'done' : 'todo';

const isoDate = (s?: string) => (s ? s.slice(0, 10) : '');

type Repeat = 'daily' | 'weekly' | 'monthly';
const REPEAT_RE = /\{\{repeat:(daily|weekly|monthly)\}\}/i;

function parseRepeat(body: string): Repeat | null {
  const m = body.match(REPEAT_RE);
  return m ? (m[1].toLowerCase() as Repeat) : null;
}

function setRepeat(body: string, r: Repeat | null): string {
  const stripped = body.replace(REPEAT_RE, '').replace(/\n{3,}/g, '\n\n').trim();
  if (!r) return stripped;
  return stripped ? `${stripped}\n\n{{repeat:${r}}}` : `{{repeat:${r}}}`;
}

function advanceDate(iso: string, r: Repeat): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (r === 'daily') d.setDate(d.getDate() + 1);
  else if (r === 'weekly') d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

interface ChecklistItem {
  lineIdx: number;
  checked: boolean;
  text: string;
}

function parseChecklist(body: string): ChecklistItem[] {
  const lines = body.split('\n');
  const items: ChecklistItem[] = [];
  lines.forEach((line, i) => {
    const m = line.match(/^(\s*)[-*]\s+\[( |x|X)\]\s+(.*)$/);
    if (m) {
      items.push({
        lineIdx: i,
        checked: m[2].toLowerCase() === 'x',
        text: m[3],
      });
    }
  });
  return items;
}

function toggleChecklistLine(body: string, lineIdx: number): string {
  const lines = body.split('\n');
  const line = lines[lineIdx];
  if (!line) return body;
  lines[lineIdx] = line.replace(
    /^(\s*[-*]\s+\[)( |x|X)(\]\s+.*)$/,
    (_m, a, c, b) => `${a}${c === ' ' ? 'x' : ' '}${b}`,
  );
  return lines.join('\n');
}

function formatDue(due: string | undefined, palette: any): { label: string; color: string } | null {
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(due);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0)
    return { label: `${-diff}d overdue`, color: palette.danger };
  if (diff === 0) return { label: 'Due today', color: palette.statusWarning };
  if (diff === 1) return { label: 'Due tomorrow', color: palette.textSecondary };
  if (diff <= 7) return { label: `Due in ${diff}d`, color: palette.textSecondary };
  return {
    label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    color: palette.textTertiary,
  };
}

export default function TasksScreen() {
  const { palette, radii, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ open?: string }>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [membersById, setMembersById] = useState<Record<string, Member>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [projectSheetOpen, setProjectSheetOpen] = useState(false);
  const [groupByPriority, setGroupByPriority] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [viewing, setViewing] = useState<Task | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, projs] = await Promise.all([api.listTasks(), api.listProjects()]);
      setTasks(list);
      setProjects(projs);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const assignedProjectIds = Array.from(
      new Set(tasks.filter((t) => t.assigneeId).map((t) => t.projectId)),
    );
    if (assignedProjectIds.length === 0) return;
    let cancelled = false;
    Promise.all(assignedProjectIds.map((pid) => api.listMembers(pid).catch(() => [])))
      .then((lists) => {
        if (cancelled) return;
        const map: Record<string, Member> = {};
        for (const list of lists) for (const m of list) map[m.userId] = m;
        setMembersById((prev) => ({ ...prev, ...map }));
      });
    return () => {
      cancelled = true;
    };
  }, [tasks]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!params.open || tasks.length === 0) return;
    const t = tasks.find((x) => x.id === params.open);
    if (t) {
      setViewing(t);
      router.setParams({ open: undefined } as any);
    }
  }, [params.open, tasks, router]);

  const [todayOnly, setTodayOnly] = useState(false);

  const filtered = useMemo(() => {
    let list = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);
    if (tagFilter) list = list.filter((t) => t.tags?.includes(tagFilter));
    if (projectFilter) list = list.filter((t) => t.projectId === projectFilter);
    if (todayOnly) {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      list = list.filter((t) => {
        if (!t.dueDate) return false;
        return new Date(t.dueDate).getTime() <= end.getTime() && t.status !== 'done';
      });
    }
    return list;
  }, [tasks, filter, tagFilter, projectFilter, todayOnly]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === projectFilter) ?? null,
    [projects, projectFilter],
  );

  const counts = useMemo(
    () => ({
      all: tasks.length,
      todo: tasks.filter((t) => t.status === 'todo').length,
      'in-progress': tasks.filter((t) => t.status === 'in-progress').length,
      done: tasks.filter((t) => t.status === 'done').length,
    }),
    [tasks],
  );

  const cycleStatus = async (task: Task) => {
    const next = nextStatus(task.status);
    if (next === 'done') haptic.success();
    else haptic.selection();
    const repeat = task.body ? parseRepeat(task.body) : null;
    if (next === 'done' && repeat && task.dueDate) {
      const nextDue = advanceDate(task.dueDate, repeat);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: 'todo', dueDate: nextDue } : t,
        ),
      );
      try {
        await api.updateTask(task.id, { status: 'todo', dueDate: nextDue });
      } catch {
        load();
      }
      return;
    }
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)),
    );
    try {
      await api.updateTask(task.id, { status: next });
    } catch {
      load();
    }
  };

  const patchTask = async (id: string, patch: Partial<Task>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    try {
      const updated = await api.updateTask(id, patch);
      if (updated) {
        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      }
      return updated;
    } catch (e) {
      load();
      throw e;
    }
  };

  const deleteTask = async (id: string) => {
    haptic.warning();
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await api.deleteTask(id);
    } catch {
      load();
    }
  };

  const handleCreated = (t: Task, proj?: Project) => {
    setTasks((prev) => [t, ...prev]);
    if (proj)
      setProjects((prev) =>
        prev.find((p) => p.id === proj.id) ? prev : [...prev, proj],
      );
  };

  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.flex, { backgroundColor: palette.bg }]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.sm,
          gap: spacing.sm,
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.sm }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.7}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radii.pill,
                  backgroundColor: active ? palette.accent : palette.surface,
                  borderWidth: 1,
                  borderColor: active ? palette.accent : palette.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Text
                  style={{
                    color: active ? palette.textInverse : palette.textPrimary,
                    fontFamily: 'Inter_500Medium',
                    fontSize: 13,
                  }}
                >
                  {f.label}
                </Text>
                <Text
                  style={{
                    color: active ? palette.textInverse : palette.textTertiary,
                    fontFamily: 'Inter_500Medium',
                    fontSize: 12,
                    opacity: 0.85,
                  }}
                >
                  {counts[f.key]}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            onPress={() => {
              haptic.selection();
              setTodayOnly((v) => !v);
            }}
            activeOpacity={0.7}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radii.pill,
              backgroundColor: todayOnly ? palette.statusWarning : palette.surface,
              borderWidth: 1,
              borderColor: todayOnly ? palette.statusWarning : palette.border,
            }}
          >
            <Text
              style={{
                color: todayOnly ? '#000' : palette.textPrimary,
                fontFamily: 'Inter_500Medium',
                fontSize: 13,
              }}
            >
              Today
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setGroupByPriority((v) => !v)}
            activeOpacity={0.7}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radii.pill,
              backgroundColor: groupByPriority ? palette.accentLight : palette.surface,
              borderWidth: 1,
              borderColor: groupByPriority ? palette.accent : palette.border,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Flag
              size={12}
              color={groupByPriority ? palette.accent : palette.textTertiary}
            />
            <Text
              style={{
                color: groupByPriority ? palette.accent : palette.textPrimary,
                fontFamily: 'Inter_500Medium',
                fontSize: 13,
              }}
            >
              By priority
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setProjectSheetOpen(true)}
            activeOpacity={0.7}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radii.pill,
              backgroundColor: activeProject ? palette.accent : palette.surface,
              borderWidth: 1,
              borderColor: activeProject ? palette.accent : palette.border,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {activeProject && (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: activeProject.color ?? palette.textInverse,
                }}
              />
            )}
            <Text
              style={{
                color: activeProject ? palette.textInverse : palette.textPrimary,
                fontFamily: 'Inter_500Medium',
                fontSize: 13,
              }}
            >
              {activeProject ? activeProject.name : 'All projects'}
            </Text>
          </TouchableOpacity>
          {tagFilter && (
            <TouchableOpacity
              onPress={() => setTagFilter(null)}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radii.pill,
                backgroundColor: palette.accent,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Text
                style={{
                  color: palette.textInverse,
                  fontFamily: 'Inter_500Medium',
                  fontSize: 13,
                }}
              >
                @{tagFilter}
              </Text>
              <Text style={{ color: palette.textInverse, fontSize: 15, marginTop: -2 }}>
                ×
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
        <TouchableOpacity
          onPress={() => router.push('/search' as any)}
          activeOpacity={0.7}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Search"
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Search size={16} color={palette.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : groupByPriority ? (
        <SectionList
          sections={[
            { title: 'High', color: palette.danger, data: filtered.filter((t) => t.priority === 'high') },
            { title: 'Medium', color: palette.statusWarning, data: filtered.filter((t) => t.priority === 'medium') },
            { title: 'Low', color: palette.statusActive, data: filtered.filter((t) => t.priority === 'low') },
            { title: 'No priority', color: palette.textTertiary, data: filtered.filter((t) => !t.priority) },
          ].filter((s) => s.data.length > 0)}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: 120,
          }}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={palette.accent}
            />
          }
          renderSectionHeader={({ section }) => (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingTop: spacing.md,
                paddingBottom: spacing.sm,
              }}
            >
              <Flag size={14} color={section.color} />
              <Text
                style={{
                  color: section.color,
                  fontSize: 12,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  fontFamily: 'Inter_600SemiBold',
                }}
              >
                {section.title}
              </Text>
              <Text
                style={{
                  color: palette.textTertiary,
                  fontSize: 12,
                  fontFamily: 'Inter_400Regular',
                }}
              >
                {section.data.length}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={{ marginBottom: spacing.sm }}>
              <TaskRow
                task={item}
                projects={projects}
                assignee={item.assigneeId ? membersById[item.assigneeId] : undefined}
                onPressStatus={() => cycleStatus(item)}
                onPress={() => setViewing(item)}
              />
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon={SearchX}
              title={error ?? 'No tasks match'}
              description={error ? undefined : 'Try clearing filters or tags to see more.'}
            />
          }
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{
            padding: spacing.lg,
            paddingTop: spacing.sm,
            gap: spacing.sm,
            paddingBottom: 120,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={palette.accent}
            />
          }
          ListEmptyComponent={
            error ? (
              <EmptyState title={error} />
            ) : filter === 'all' && !tagFilter ? (
              <EmptyState
                icon={Inbox}
                tone="accent"
                title="Nothing here yet"
                description="Capture what's on your mind — tasks, ideas, errands. They'll live here."
                actionLabel="Add your first task"
                onAction={() => setCreating(true)}
              />
            ) : (
              <EmptyState
                icon={SearchX}
                title="No tasks match"
                description="Try a different filter or clear the active tag."
              />
            )
          }
          renderItem={({ item }) => (
            <TaskRow
              task={item}
              projects={projects}
              assignee={item.assigneeId ? membersById[item.assigneeId] : undefined}
              onPressStatus={() => cycleStatus(item)}
              onPress={() => setViewing(item)}
              onTagPress={(tag) => setTagFilter((cur) => (cur === tag ? null : tag))}
            />
          )}
        />
      )}

      <TaskViewModal
        visible={!!viewing}
        task={viewing ? tasks.find((t) => t.id === viewing.id) ?? viewing : null}
        project={viewing ? projects.find((p) => p.id === viewing.projectId) ?? null : null}
        assignee={
          viewing && viewing.assigneeId ? membersById[viewing.assigneeId] : undefined
        }
        onClose={() => setViewing(null)}
        onEdit={() => {
          if (!viewing) return;
          const current = tasks.find((t) => t.id === viewing.id) ?? viewing;
          setViewing(null);
          setEditing(current);
        }}
        onStatusCycle={() => {
          if (!viewing) return;
          const current = tasks.find((t) => t.id === viewing.id) ?? viewing;
          cycleStatus(current);
        }}
      />
      <TouchableOpacity
        onPress={() => setCreating(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="New task"
        style={[
          styles.fab,
          {
            backgroundColor: palette.accent,
            bottom: insets.bottom + 80,
          },
        ]}
      >
        <Plus color={palette.textInverse} size={26} strokeWidth={2.5} />
      </TouchableOpacity>

      <ProjectSheet
        visible={projectSheetOpen}
        projects={projects}
        tasks={tasks}
        selected={projectFilter}
        onClose={() => setProjectSheetOpen(false)}
        onSelect={(id) => {
          haptic.selection();
          setProjectFilter(id);
          setProjectSheetOpen(false);
        }}
      />

      <TaskFormModal
        visible={creating}
        mode="create"
        projects={projects}
        onClose={() => setCreating(false)}
        onCreated={handleCreated}
      />
      <TaskFormModal
        visible={!!editing}
        mode="edit"
        task={editing ?? undefined}
        projects={projects}
        onClose={() => setEditing(null)}
        onPatch={async (patch) => {
          if (!editing) return;
          await patchTask(editing.id, patch);
        }}
        onDelete={async () => {
          if (!editing) return;
          const id = editing.id;
          setEditing(null);
          await deleteTask(id);
        }}
      />
    </SafeAreaView>
  );
}

function StatusIndicator({ status }: { status: Task['status'] }) {
  const { palette } = useTheme();
  const size = 22;
  if (status === 'done') {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: palette.statusActive,
          borderWidth: 2,
          borderColor: palette.statusActive,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Check color="#fff" size={12} strokeWidth={3} />
      </View>
    );
  }
  if (status === 'in-progress') {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: palette.accent,
          backgroundColor: palette.accentLight,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: palette.accent,
          }}
        />
      </View>
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: palette.border,
      }}
    />
  );
}

interface TaskRowProps {
  task: Task;
  projects: Project[];
  assignee?: Member;
  onPressStatus: () => void;
  onPress: () => void;
  onTagPress?: (tag: string) => void;
}

function TaskRow({ task, projects, assignee, onPressStatus, onPress, onTagPress }: TaskRowProps) {
  const { palette, radii, spacing, fontSize } = useTheme();
  const project = projects.find((p) => p.id === task.projectId);
  const due = formatDue(task.dueDate, palette);
  const pri = task.priority;
  const priMeta: Record<NonNullable<Task['priority']>, { label: string; color: string }> = {
    low: { label: 'Low', color: palette.textTertiary },
    medium: { label: 'Med', color: palette.statusWarning },
    high: { label: 'High', color: palette.danger },
  };
  const isDone = task.status === 'done';

  return (
    <View
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.border,
        borderWidth: 1,
        borderRadius: radii.lg,
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        gap: spacing.md,
        opacity: isDone ? 0.6 : 1,
      }}
    >
      <TouchableOpacity
        onPress={onPressStatus}
        activeOpacity={0.6}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Task status: ${task.status}. Tap to advance.`}
        style={{ paddingTop: 2 }}
      >
        <StatusIndicator status={task.status} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ flex: 1 }}>
        <Text
          style={{
            color: isDone ? palette.textTertiary : palette.textPrimary,
            fontSize: fontSize.base,
            lineHeight: 20,
            fontFamily: 'Inter_500Medium',
            textDecorationLine: isDone ? 'line-through' : 'none',
          }}
        >
          {task.title}
        </Text>
        {task.body ? (
          <Text
            numberOfLines={1}
            style={{
              color: palette.textTertiary,
              fontSize: fontSize.xs,
              marginTop: 2,
              fontFamily: 'Inter_400Regular',
            }}
          >
            {task.body.split('\n')[0]}
          </Text>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 6,
            flexWrap: 'wrap',
          }}
        >
          {task.tags?.slice(0, 4).map((tag) => (
            <TouchableOpacity
              key={tag}
              activeOpacity={0.6}
              disabled={!onTagPress}
              onPress={() => onTagPress?.(tag)}
              style={{
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: palette.accentLight,
              }}
            >
              <Text
                style={{
                  color: palette.accent,
                  fontSize: fontSize['2xs'],
                  fontFamily: 'Inter_500Medium',
                }}
              >
                @{tag}
              </Text>
            </TouchableOpacity>
          ))}
          {pri && priMeta[pri] && !isDone && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Flag size={11} color={priMeta[pri].color} />
              <Text
                style={{
                  color: priMeta[pri].color,
                  fontSize: fontSize['2xs'],
                  fontFamily: 'Inter_500Medium',
                }}
              >
                {priMeta[pri].label}
              </Text>
            </View>
          )}
          {due && !isDone && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <CalendarClock size={11} color={due.color} />
              <Text
                style={{
                  color: due.color,
                  fontSize: fontSize['2xs'],
                  fontFamily: 'Inter_500Medium',
                }}
              >
                {due.label}
              </Text>
            </View>
          )}
          {project && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: project.color ?? palette.textTertiary,
                }}
              />
              <Text
                style={{
                  color: palette.textTertiary,
                  fontSize: fontSize['2xs'],
                  fontFamily: 'Inter_400Regular',
                }}
              >
                {project.name}
              </Text>
            </View>
          )}
          {task.assigneeId && (
            <AssigneeChip assignee={assignee} assigneeId={task.assigneeId} />
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

function AssigneeChip({ assignee, assigneeId }: { assignee?: Member; assigneeId: string }) {
  const { palette, fontSize } = useTheme();
  const label = assignee?.name ?? '…';
  const initials = (assignee?.name ?? '?')
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: palette.accentLight,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: palette.accent,
            fontSize: 8,
            fontFamily: 'Inter_600SemiBold',
          }}
        >
          {initials}
        </Text>
      </View>
      <Text
        style={{
          color: palette.textTertiary,
          fontSize: fontSize['2xs'],
          fontFamily: 'Inter_500Medium',
        }}
        numberOfLines={1}
      >
        {assignee ? label : assigneeId.slice(0, 6)}
      </Text>
    </View>
  );
}

interface TaskViewProps {
  visible: boolean;
  task: Task | null;
  project: Project | null;
  assignee?: Member;
  onClose: () => void;
  onEdit: () => void;
  onStatusCycle: () => void;
}

function TaskViewModal({ visible, task, project, assignee, onClose, onEdit, onStatusCycle }: TaskViewProps) {
  const { palette, radii, spacing, fontSize } = useTheme();

  const share = async () => {
    if (!task) return;
    const base =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}`
        : 'https://urban-tasks.app/';
    const url = `${base}?task=${task.id}`;
    try {
      if (Platform.OS === 'web') {
        const nav = (typeof navigator !== 'undefined' ? navigator : null) as
          | (Navigator & { share?: (data: { title?: string; url?: string }) => Promise<void> })
          | null;
        if (nav?.share) {
          await nav.share({ title: task.title, url });
          return;
        }
        if (nav?.clipboard?.writeText) {
          await nav.clipboard.writeText(url);
          return;
        }
      }
      await Share.share({ message: url, url, title: task.title });
    } catch {
      /* user cancelled or unavailable */
    }
  };

  if (!task) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} transparent={false}>
        <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }} />
      </Modal>
    );
  }

  const due = formatDue(task.dueDate, palette);
  const pri = task.priority;
  const priMeta: Record<NonNullable<Task['priority']>, { label: string; color: string }> = {
    low: { label: 'Low', color: palette.statusActive },
    medium: { label: 'Medium', color: palette.statusWarning },
    high: { label: 'High', color: palette.danger },
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      transparent={false}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderBottomColor: palette.borderLight,
            borderBottomWidth: 1,
          }}
        >
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <X size={22} color={palette.textSecondary} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <TouchableOpacity onPress={share} hitSlop={10} accessibilityRole="button" accessibilityLabel="Share task">
              <Share2 size={20} color={palette.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onEdit} hitSlop={10} accessibilityRole="button" accessibilityLabel="Edit task">
              <Pencil size={20} color={palette.accent} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
            <TouchableOpacity
              onPress={onStatusCycle}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radii.pill,
                backgroundColor: palette.surface,
                borderWidth: 1,
                borderColor: palette.border,
              }}
            >
              <StatusIndicator status={task.status} />
              <Text style={{ color: palette.textPrimary, fontFamily: 'Inter_500Medium', fontSize: 13 }}>
                {STATUS_LABEL[task.status]}
              </Text>
            </TouchableOpacity>
            {project && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: project.color ?? palette.textTertiary,
                  }}
                />
                <Text style={{ color: palette.textSecondary, fontSize: fontSize.sm, fontFamily: 'Inter_500Medium' }}>
                  {project.name}
                </Text>
              </View>
            )}
          </View>

          <Text
            style={{
              color: task.status === 'done' ? palette.textTertiary : palette.textPrimary,
              fontSize: 22,
              lineHeight: 28,
              fontFamily: 'Fraunces_600SemiBold',
              textDecorationLine: task.status === 'done' ? 'line-through' : 'none',
            }}
          >
            {task.title}
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {pri && priMeta[pri] && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: spacing.sm + 2,
                  paddingVertical: 4,
                  borderRadius: radii.pill,
                  backgroundColor: palette.surface,
                  borderWidth: 1,
                  borderColor: palette.border,
                }}
              >
                <Flag size={12} color={priMeta[pri].color} />
                <Text style={{ color: priMeta[pri].color, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
                  {priMeta[pri].label}
                </Text>
              </View>
            )}
            {due && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: spacing.sm + 2,
                  paddingVertical: 4,
                  borderRadius: radii.pill,
                  backgroundColor: palette.surface,
                  borderWidth: 1,
                  borderColor: palette.border,
                }}
              >
                <CalendarClock size={12} color={due.color} />
                <Text style={{ color: due.color, fontSize: 12, fontFamily: 'Inter_500Medium' }}>{due.label}</Text>
              </View>
            )}
            {task.tags?.map((tag) => (
              <View
                key={tag}
                style={{
                  paddingHorizontal: spacing.sm + 2,
                  paddingVertical: 4,
                  borderRadius: radii.pill,
                  backgroundColor: palette.accentLight,
                }}
              >
                <Text style={{ color: palette.accent, fontSize: 12, fontFamily: 'Inter_500Medium' }}>@{tag}</Text>
              </View>
            ))}
            {task.assigneeId && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: spacing.sm + 2,
                  paddingVertical: 4,
                  borderRadius: radii.pill,
                  backgroundColor: palette.surface,
                  borderWidth: 1,
                  borderColor: palette.border,
                }}
              >
                <Text style={{ color: palette.textSecondary, fontSize: 12, fontFamily: 'Inter_500Medium' }}>
                  {assignee ? `@ ${assignee.name}` : '@ assigned'}
                </Text>
              </View>
            )}
          </View>

          {task.body?.trim() ? (
            <View style={{ gap: spacing.sm }}>
              <Text
                style={{
                  color: palette.textTertiary,
                  fontSize: 11,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  fontFamily: 'Inter_500Medium',
                }}
              >
                Notes
              </Text>
              <View
                style={{
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  borderWidth: 1,
                  borderRadius: radii.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm + 2,
                }}
              >
                <Markdown>{task.body}</Markdown>
              </View>
            </View>
          ) : (
            <Text style={{ color: palette.textTertiary, fontSize: 13, fontStyle: 'italic' }}>
              No notes — tap edit to add markdown notes, subtasks, or links.
            </Text>
          )}

          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

interface TaskFormProps {
  visible: boolean;
  mode: 'create' | 'edit';
  task?: Task;
  projects: Project[];
  onClose: () => void;
  onCreated?: (task: Task, project?: Project) => void;
  onPatch?: (patch: Partial<Task>) => Promise<void>;
  onDelete?: () => Promise<void>;
}

function TaskFormModal({
  visible,
  mode,
  task,
  projects,
  onClose,
  onCreated,
  onPatch,
  onDelete,
}: TaskFormProps) {
  const { palette, radii, spacing } = useTheme();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | null>(null);
  const [status, setStatus] = useState<Task['status']>('todo');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | undefined>(undefined);
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [tags, setTags] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false);
  const [notesPreview, setNotesPreview] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (mode === 'edit' && task) {
      setTitle(task.title);
      setBody(task.body ?? '');
      setPriority(task.priority ?? null);
      setStatus(task.status);
      setProjectId(task.projectId);
      setDueDate(task.dueDate ? isoDate(task.dueDate) : undefined);
      setStartDate(task.startDate ? isoDate(task.startDate) : undefined);
      setTags((task.tags ?? []).join(', '));
      setAssigneeId(task.assigneeId ?? null);
    } else {
      setTitle('');
      setBody('');
      setPriority(null);
      setStatus('todo');
      setProjectId(projects[0]?.id ?? null);
      setDueDate(undefined);
      setStartDate(undefined);
      setTags('');
      setAssigneeId(null);
    }
    setErr(null);
  }, [visible, mode, task, projects]);

  useEffect(() => {
    if (!visible || !projectId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    api
      .listMembers(projectId)
      .then((m) => {
        if (!cancelled) setMembers(m);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, projectId]);

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const parsedTags = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const normalizedDue = dueDate && dueDate.trim() ? dueDate.trim() : undefined;
      const normalizedStart = startDate && startDate.trim() ? startDate.trim() : undefined;

      if (mode === 'create') {
        let pid = projectId;
        let created: Project | undefined;
        if (!pid) {
          created = await api.createProject('Personal', '#c96442');
          pid = created.id;
        }
        const t = await api.createTask({
          projectId: pid,
          title: title.trim(),
          body: body.trim() || undefined,
          priority: priority ?? undefined,
          assigneeId: assigneeId ?? undefined,
        });
        // dueDate/tags via follow-up patch (createTask supports limited fields here)
        if (normalizedDue || normalizedStart || parsedTags.length) {
          await api.updateTask(t.id, {
            ...(normalizedDue ? { dueDate: normalizedDue } : {}),
            ...(normalizedStart ? { startDate: normalizedStart } : {}),
            ...(parsedTags.length ? { tags: parsedTags } : {}),
          });
        }
        onCreated?.(
          {
            ...t,
            ...(normalizedDue ? { dueDate: normalizedDue } : {}),
            ...(normalizedStart ? { startDate: normalizedStart } : {}),
            ...(parsedTags.length ? { tags: parsedTags } : {}),
          },
          created,
        );
      } else if (onPatch) {
        await onPatch({
          title: title.trim(),
          body: body.trim() || undefined,
          priority: priority ?? undefined,
          status,
          projectId: projectId ?? undefined,
          dueDate: normalizedDue,
          startDate: normalizedStart,
          tags: parsedTags,
          assigneeId: assigneeId ?? '',
        });
      }
      onClose();
    } catch (e) {
      setErr(friendlyErrorMessage(e, 'Failed to save'));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    const go = async () => {
      if (!onDelete) return;
      setBusy(true);
      try {
        await onDelete();
      } finally {
        setBusy(false);
      }
    };
    if (Platform.OS === 'web') {
      // Alert on web is blocking & ugly; use window.confirm
      // @ts-ignore
      if (window.confirm('Delete this task?')) go();
      return;
    }
    Alert.alert('Delete task', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: go },
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      transparent={false}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderBottomColor: palette.borderLight,
              borderBottomWidth: 1,
            }}
          >
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text
                style={{
                  color: palette.textSecondary,
                  fontSize: 15,
                  fontFamily: 'Inter_500Medium',
                }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <Text
              style={{
                color: palette.textPrimary,
                fontSize: 16,
                fontFamily: 'Fraunces_600SemiBold',
              }}
            >
              {mode === 'create' ? 'New task' : 'Edit task'}
            </Text>
            <TouchableOpacity
              onPress={submit}
              disabled={busy || !title.trim()}
              hitSlop={10}
            >
              <Text
                style={{
                  color: !title.trim() ? palette.textTertiary : palette.accent,
                  fontSize: 15,
                  fontFamily: 'Inter_600SemiBold',
                  opacity: busy ? 0.5 : 1,
                }}
              >
                {busy ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
            keyboardShouldPersistTaps="handled"
          >
            <Field label="Title">
              <StyledInput value={title} onChangeText={setTitle} placeholder="What needs doing?" autoFocus={mode === 'create'} />
            </Field>

            <View style={{ gap: spacing.sm }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text
                  style={{
                    color: palette.textTertiary,
                    fontSize: 11,
                    letterSpacing: 1.5,
                    textTransform: 'uppercase',
                    fontFamily: 'Inter_500Medium',
                  }}
                >
                  Notes
                </Text>
                {body.trim().length > 0 && (
                  <TouchableOpacity
                    onPress={() => setNotesPreview((v) => !v)}
                    hitSlop={8}
                  >
                    <Text
                      style={{
                        color: palette.accent,
                        fontSize: 12,
                        fontFamily: 'Inter_500Medium',
                      }}
                    >
                      {notesPreview ? 'Edit' : 'Preview'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {notesPreview ? (
                <View
                  style={{
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    borderWidth: 1,
                    borderRadius: radii.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm + 2,
                    minHeight: 90,
                  }}
                >
                  <Markdown>{body}</Markdown>
                </View>
              ) : (
                <StyledInput
                  value={body}
                  onChangeText={setBody}
                  placeholder={'Add details — markdown supported\n- [ ] a subtask'}
                  multiline
                  minHeight={90}
                />
              )}
            </View>

            <SubtaskList body={body} onChange={setBody} />

            <Field label="Repeat">
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                {(['none', 'daily', 'weekly', 'monthly'] as const).map((r) => {
                  const current = parseRepeat(body) ?? 'none';
                  const active = current === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setBody(setRepeat(body, r === 'none' ? null : r))}
                      activeOpacity={0.7}
                      style={{
                        paddingVertical: spacing.sm,
                        paddingHorizontal: spacing.md,
                        borderRadius: radii.pill,
                        borderWidth: 1,
                        backgroundColor: active ? palette.accent : palette.surface,
                        borderColor: active ? palette.accent : palette.border,
                      }}
                    >
                      <Text
                        style={{
                          color: active ? palette.textInverse : palette.textPrimary,
                          fontFamily: 'Inter_500Medium',
                          fontSize: 13,
                          textTransform: 'capitalize',
                        }}
                      >
                        {r}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Field>

            {mode === 'edit' && (
              <Field label="Status">
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {(['todo', 'in-progress', 'done'] as const).map((s) => {
                    const active = status === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        onPress={() => setStatus(s)}
                        activeOpacity={0.7}
                        style={{
                          flex: 1,
                          paddingVertical: spacing.sm + 2,
                          borderRadius: radii.md,
                          borderWidth: 1,
                          alignItems: 'center',
                          backgroundColor: active ? palette.accent : palette.surface,
                          borderColor: active ? palette.accent : palette.border,
                        }}
                      >
                        <Text
                          style={{
                            color: active ? palette.textInverse : palette.textPrimary,
                            fontFamily: 'Inter_500Medium',
                            fontSize: 13,
                          }}
                        >
                          {STATUS_LABEL[s]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Field>
            )}

            <Field label="Priority">
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {(['low', 'medium', 'high'] as const).map((p) => {
                  const active = priority === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setPriority(active ? null : p)}
                      activeOpacity={0.7}
                      style={{
                        flex: 1,
                        paddingVertical: spacing.sm + 2,
                        borderRadius: radii.md,
                        borderWidth: 1,
                        alignItems: 'center',
                        backgroundColor: active
                          ? priorityColor(p, palette)
                          : palette.surface,
                        borderColor: active ? priorityColor(p, palette) : palette.border,
                      }}
                    >
                      <Text
                        style={{
                          color: active ? '#000' : palette.textPrimary,
                          fontFamily: active ? 'Inter_600SemiBold' : 'Inter_500Medium',
                          fontSize: 13,
                          textTransform: 'capitalize',
                        }}
                      >
                        {p}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Field>

            <Field label="Assignee">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                <TouchableOpacity
                  onPress={() => setAssigneeId(null)}
                  activeOpacity={0.7}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: radii.md,
                    borderWidth: 1,
                    backgroundColor: !assigneeId ? palette.surfaceHover : palette.surface,
                    borderColor: !assigneeId ? palette.border : palette.border,
                  }}
                >
                  <Text
                    style={{
                      color: palette.textPrimary,
                      fontFamily: !assigneeId ? 'Inter_600SemiBold' : 'Inter_500Medium',
                      fontSize: 13,
                    }}
                  >
                    Unassigned
                  </Text>
                </TouchableOpacity>
                {members.map((m) => {
                  const active = assigneeId === m.userId;
                  return (
                    <TouchableOpacity
                      key={m.userId}
                      onPress={() => setAssigneeId(active ? null : m.userId)}
                      activeOpacity={0.7}
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderRadius: radii.md,
                        borderWidth: 1,
                        backgroundColor: active ? palette.accent : palette.surface,
                        borderColor: active ? palette.accent : palette.border,
                      }}
                    >
                      <Text
                        style={{
                          color: active ? '#000' : palette.textPrimary,
                          fontFamily: active ? 'Inter_600SemiBold' : 'Inter_500Medium',
                          fontSize: 13,
                        }}
                      >
                        {m.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Field>

            <Field label="Start date">
              <DateField value={startDate} onChange={setStartDate} placeholder="Pick a start date" />
            </Field>

            <Field label="Due date">
              <DateField value={dueDate} onChange={setDueDate} placeholder="Pick a due date" />
            </Field>

            <Field label="Tags (comma-separated)">
              <StyledInput
                value={tags}
                onChangeText={setTags}
                placeholder="work, urgent"
                autoCapitalize="none"
              />
            </Field>

            {projects.length > 0 && (
              <Field label="Project">
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
                >
                  {projects.map((p) => {
                    const active = projectId === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => setProjectId(p.id)}
                        activeOpacity={0.7}
                        style={{
                          paddingVertical: spacing.sm,
                          paddingHorizontal: spacing.md,
                          borderRadius: radii.pill,
                          borderWidth: 1,
                          backgroundColor: active ? palette.accent : palette.surface,
                          borderColor: active ? palette.accent : palette.border,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {p.color && (
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: p.color,
                            }}
                          />
                        )}
                        <Text
                          style={{
                            color: active ? palette.textInverse : palette.textPrimary,
                            fontFamily: 'Inter_500Medium',
                            fontSize: 13,
                          }}
                        >
                          {p.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Field>
            )}

            {mode === 'edit' && onDelete && (
              <TouchableOpacity
                onPress={confirmDelete}
                activeOpacity={0.7}
                style={{
                  marginTop: spacing.md,
                  paddingVertical: spacing.md,
                  borderRadius: radii.md,
                  borderWidth: 1,
                  borderColor: palette.danger,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    color: palette.danger,
                    fontFamily: 'Inter_500Medium',
                    fontSize: 14,
                  }}
                >
                  Delete task
                </Text>
              </TouchableOpacity>
            )}

            {err && (
              <Text
                style={{ color: palette.danger, fontFamily: 'Inter_400Regular' }}
              >
                {err}
              </Text>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function StyledInput({
  minHeight,
  multiline,
  ...props
}: React.ComponentProps<typeof TextInput> & { minHeight?: number }) {
  const { palette, radii, spacing } = useTheme();
  const [focused, setFocused] = React.useState(false);
  return (
    <TextInput
      {...props}
      multiline={multiline}
      placeholderTextColor={palette.textTertiary}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={{
        backgroundColor: palette.surface,
        borderColor: focused ? palette.borderFocus : palette.border,
        borderWidth: 1,
        borderRadius: radii.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        fontSize: 15,
        color: palette.textPrimary,
        fontFamily: 'Inter_400Regular',
        ...(multiline
          ? { minHeight: minHeight ?? 90, textAlignVertical: 'top' as const }
          : {}),
      }}
    />
  );
}

function SubtaskList({ body, onChange }: { body: string; onChange: (next: string) => void }) {
  const { palette, radii, spacing } = useTheme();
  const items = parseChecklist(body);
  const [draft, setDraft] = useState('');
  if (items.length === 0 && !body.includes('- [')) {
    return (
      <View style={{ gap: spacing.sm }}>
        <Text
          style={{
            color: palette.textTertiary,
            fontSize: 11,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            fontFamily: 'Inter_500Medium',
          }}
        >
          Subtasks
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <StyledInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Add a subtask"
              onSubmitEditing={() => {
                const t = draft.trim();
                if (!t) return;
                const next = body ? `${body}\n- [ ] ${t}` : `- [ ] ${t}`;
                onChange(next);
                setDraft('');
              }}
              returnKeyType="done"
            />
          </View>
        </View>
      </View>
    );
  }
  const done = items.filter((i) => i.checked).length;
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text
          style={{
            color: palette.textTertiary,
            fontSize: 11,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            fontFamily: 'Inter_500Medium',
          }}
        >
          Subtasks
        </Text>
        <Text
          style={{
            color: palette.textTertiary,
            fontSize: 12,
            fontFamily: 'Inter_500Medium',
          }}
        >
          {done}/{items.length}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: palette.surface,
          borderWidth: 1,
          borderColor: palette.border,
          borderRadius: radii.md,
          overflow: 'hidden',
        }}
      >
        {items.map((item, idx) => (
          <TouchableOpacity
            key={item.lineIdx}
            onPress={() => onChange(toggleChecklistLine(body, item.lineIdx))}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm + 2,
              borderTopWidth: idx === 0 ? 0 : 1,
              borderTopColor: palette.borderLight,
            }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                borderWidth: 1.5,
                borderColor: item.checked ? palette.statusActive : palette.border,
                backgroundColor: item.checked ? palette.statusActive : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {item.checked && <Check color="#fff" size={12} strokeWidth={3} />}
            </View>
            <Text
              style={{
                flex: 1,
                color: item.checked ? palette.textTertiary : palette.textPrimary,
                fontFamily: 'Inter_400Regular',
                fontSize: 14,
                textDecorationLine: item.checked ? 'line-through' : 'none',
              }}
            >
              {item.text}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <StyledInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Add a subtask"
        onSubmitEditing={() => {
          const t = draft.trim();
          if (!t) return;
          onChange(`${body}\n- [ ] ${t}`);
          setDraft('');
        }}
        returnKeyType="done"
      />
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { palette, spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text
        style={{
          color: palette.textTertiary,
          fontSize: 11,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          fontFamily: 'Inter_500Medium',
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

interface ProjectSheetProps {
  visible: boolean;
  projects: Project[];
  tasks: Task[];
  selected: string | null;
  onClose: () => void;
  onSelect: (id: string | null) => void;
}

function ProjectSheet({ visible, projects, tasks, selected, onClose, onSelect }: ProjectSheetProps) {
  const { palette, radii, spacing, fontSize } = useTheme();
  const insets = useSafeAreaInsets();
  const openFor = (id: string) =>
    tasks.filter((t) => t.projectId === id && t.status !== 'done').length;
  const allOpen = tasks.filter((t) => t.status !== 'done').length;

  const Row = ({
    active,
    onPress,
    dot,
    label,
    count,
  }: {
    active: boolean;
    onPress: () => void;
    dot: string | null;
    label: string;
    count: number;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: radii.md,
        backgroundColor: active ? palette.accentLight : 'transparent',
      }}
    >
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: dot ?? palette.border,
        }}
      />
      <Text
        style={{
          flex: 1,
          color: active ? palette.accent : palette.textPrimary,
          fontFamily: active ? 'Inter_600SemiBold' : 'Inter_500Medium',
          fontSize: fontSize.base,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: palette.textTertiary,
          fontFamily: 'Inter_400Regular',
          fontSize: fontSize.xs,
        }}
      >
        {count}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'flex-end',
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {}}
          style={{
            backgroundColor: palette.bg,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            paddingBottom: insets.bottom + spacing.md,
            paddingTop: spacing.sm,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 38,
              height: 4,
              borderRadius: 2,
              backgroundColor: palette.border,
              marginBottom: spacing.md,
            }}
          />
          <Text
            style={{
              paddingHorizontal: spacing.lg,
              color: palette.textTertiary,
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              fontFamily: 'Inter_500Medium',
              marginBottom: spacing.sm,
            }}
          >
            Filter by project
          </Text>
          <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ paddingBottom: spacing.sm }}>
            <Row
              active={selected === null}
              onPress={() => onSelect(null)}
              dot={null}
              label="All projects"
              count={allOpen}
            />
            {projects.map((p) => (
              <Row
                key={p.id}
                active={selected === p.id}
                onPress={() => onSelect(p.id)}
                dot={p.color ?? palette.accent}
                label={p.name}
                count={openFor(p.id)}
              />
            ))}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function priorityColor(
  p: NonNullable<Task['priority']>,
  palette: ReturnType<typeof useTheme>['palette'],
) {
  if (p === 'high') return palette.danger;
  if (p === 'medium') return palette.statusWarning;
  return palette.statusActive;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
