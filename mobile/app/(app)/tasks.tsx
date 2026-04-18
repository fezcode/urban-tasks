import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { api, Task, Project } from '@/api/client';

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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

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

  const filtered = useMemo(
    () => (filter === 'all' ? tasks : tasks.filter((t) => t.status === filter)),
    [tasks, filter],
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
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      return updated;
    } catch (e) {
      load();
      throw e;
    }
  };

  const deleteTask = async (id: string) => {
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
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.sm,
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
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
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
        </View>
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
            <View style={{ alignItems: 'center', paddingTop: 64, gap: spacing.sm }}>
              <Text
                style={{
                  color: palette.textSecondary,
                  fontFamily: 'Fraunces_400Regular',
                  fontSize: 20,
                }}
              >
                {error ?? (filter === 'all' ? 'Nothing here yet.' : 'No tasks match.')}
              </Text>
              {!error && filter === 'all' && (
                <Text
                  style={{
                    color: palette.textTertiary,
                    fontFamily: 'Inter_400Regular',
                    fontSize: 13,
                  }}
                >
                  Tap + to add your first task.
                </Text>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const project = projects.find((p) => p.id === item.projectId);
            const due = formatDue(item.dueDate, palette);
            return (
              <View
                style={{
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  borderWidth: 1,
                  borderRadius: radii.lg,
                  flexDirection: 'row',
                  alignItems: 'stretch',
                  overflow: 'hidden',
                }}
              >
                <TouchableOpacity
                  onPress={() => cycleStatus(item)}
                  activeOpacity={0.6}
                  style={{
                    paddingLeft: spacing.md,
                    paddingRight: spacing.sm,
                    paddingVertical: spacing.md,
                    justifyContent: 'flex-start',
                  }}
                >
                  <StatusIndicator status={item.status} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setEditing(item)}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    paddingRight: spacing.md,
                    paddingVertical: spacing.md,
                  }}
                >
                  <Text
                    style={{
                      color:
                        item.status === 'done'
                          ? palette.textTertiary
                          : palette.textPrimary,
                      fontSize: 16,
                      fontFamily: 'Inter_500Medium',
                      textDecorationLine:
                        item.status === 'done' ? 'line-through' : 'none',
                    }}
                  >
                    {item.title}
                  </Text>
                  {item.body ? (
                    <Text
                      numberOfLines={2}
                      style={{
                        color: palette.textSecondary,
                        fontSize: 13,
                        marginTop: 2,
                        fontFamily: 'Inter_400Regular',
                      }}
                    >
                      {item.body}
                    </Text>
                  ) : null}
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 10,
                      marginTop: 6,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Meta color={palette.textTertiary}>
                      {STATUS_LABEL[item.status]}
                    </Meta>
                    {item.priority && (
                      <Meta color={priorityColor(item.priority, palette)}>
                        {item.priority}
                      </Meta>
                    )}
                    {due && <Meta color={due.color}>{due.label}</Meta>}
                    {project && (
                      <Meta color={project.color ?? palette.textTertiary}>
                        {project.name}
                      </Meta>
                    )}
                    {item.tags?.slice(0, 3).map((t) => (
                      <Meta key={t} color={palette.textSecondary}>
                        #{t}
                      </Meta>
                    ))}
                  </View>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      <TouchableOpacity
        onPress={() => setCreating(true)}
        activeOpacity={0.85}
        style={[
          styles.fab,
          {
            backgroundColor: palette.accent,
            bottom: insets.bottom + 80,
          },
        ]}
      >
        <Text style={{ color: palette.textInverse, fontSize: 30, marginTop: -2 }}>
          +
        </Text>
      </TouchableOpacity>

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
  const size = 24;
  if (status === 'done') {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: palette.statusActive,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{ color: palette.textInverse, fontSize: 13, fontWeight: '700' }}
        >
          ✓
        </Text>
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
          borderColor: palette.statusWarning,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: palette.statusWarning,
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
        borderWidth: 1.5,
        borderColor: palette.border,
      }}
    />
  );
}

function Meta({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <Text
      style={{
        color,
        fontSize: 11,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        fontFamily: 'Inter_500Medium',
      }}
    >
      {children}
    </Text>
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
  const [dueDate, setDueDate] = useState('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    if (mode === 'edit' && task) {
      setTitle(task.title);
      setBody(task.body ?? '');
      setPriority(task.priority ?? null);
      setStatus(task.status);
      setProjectId(task.projectId);
      setDueDate(isoDate(task.dueDate));
      setTags((task.tags ?? []).join(', '));
    } else {
      setTitle('');
      setBody('');
      setPriority(null);
      setStatus('todo');
      setProjectId(projects[0]?.id ?? null);
      setDueDate('');
      setTags('');
    }
    setErr(null);
  }, [visible, mode, task, projects]);

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const parsedTags = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const normalizedDue = dueDate.trim() || undefined;

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
        });
        // dueDate/tags via follow-up patch (createTask supports limited fields here)
        if (normalizedDue || parsedTags.length) {
          await api.updateTask(t.id, {
            ...(normalizedDue ? { dueDate: normalizedDue } : {}),
            ...(parsedTags.length ? { tags: parsedTags } : {}),
          });
        }
        onCreated?.(
          {
            ...t,
            ...(normalizedDue ? { dueDate: normalizedDue } : {}),
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
          tags: parsedTags,
        });
      }
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save');
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

            <Field label="Notes">
              <StyledInput
                value={body}
                onChangeText={setBody}
                placeholder="Add details (optional)"
                multiline
                minHeight={90}
              />
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
                          ? priorityColor(p, palette) + '22'
                          : palette.surface,
                        borderColor: active ? priorityColor(p, palette) : palette.border,
                      }}
                    >
                      <Text
                        style={{
                          color: active ? priorityColor(p, palette) : palette.textPrimary,
                          fontFamily: 'Inter_500Medium',
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

            <Field label="Due date (YYYY-MM-DD)">
              <StyledInput
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="2026-05-01"
                autoCapitalize="none"
              />
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
