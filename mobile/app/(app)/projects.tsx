import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { api, Project, Task } from '@/api/client';
import { haptic } from '@/haptics';

const COLORS = [
  '#c96442',
  '#d2af5a',
  '#5b8a72',
  '#4f7fa8',
  '#8b5a9f',
  '#c7545a',
  '#6e7785',
];

type Editing =
  | { kind: 'create' }
  | { kind: 'edit'; project: Project };

export default function ProjectsScreen() {
  const { palette, radii, spacing, fontSize } = useTheme();
  const insets = useSafeAreaInsets();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([api.listProjects(), api.listTasks()]);
      setProjects(p);
      setTasks(t);
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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const countFor = (id: string) => tasks.filter((t) => t.projectId === id).length;
  const openFor = (id: string) =>
    tasks.filter((t) => t.projectId === id && t.status !== 'done').length;

  const handleSaved = (p: Project, isNew: boolean) => {
    setProjects((prev) =>
      isNew ? [...prev, p] : prev.map((x) => (x.id === p.id ? p : x)),
    );
  };

  const handleDeleted = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setTasks((prev) => prev.filter((t) => t.projectId !== id));
  };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: palette.bg }]}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{
            padding: spacing.lg,
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
                {error ?? 'No projects yet.'}
              </Text>
              <Text
                style={{
                  color: palette.textTertiary,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 13,
                }}
              >
                Tap + to organize tasks into projects.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setEditing({ kind: 'edit', project: item })}
              activeOpacity={0.85}
              style={{
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderWidth: 1,
                borderRadius: radii.lg,
                padding: spacing.md,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
              }}
            >
              <View
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: item.color ?? palette.accent,
                }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: palette.textPrimary,
                    fontSize: fontSize.md,
                    fontFamily: 'Inter_500Medium',
                  }}
                >
                  {item.name}
                </Text>
                <Text
                  style={{
                    color: palette.textTertiary,
                    fontSize: fontSize.xs,
                    fontFamily: 'Inter_400Regular',
                    marginTop: 2,
                  }}
                >
                  {openFor(item.id)} open · {countFor(item.id)} total
                </Text>
              </View>
              <Text
                style={{
                  color: palette.textTertiary,
                  fontFamily: 'Inter_400Regular',
                  fontSize: 22,
                  marginTop: -4,
                }}
              >
                ›
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        onPress={() => setEditing({ kind: 'create' })}
        activeOpacity={0.85}
        style={[styles.fab, { backgroundColor: palette.accent, bottom: insets.bottom + 80 }]}
      >
        <Plus color={palette.textInverse} size={26} strokeWidth={2.5} />
      </TouchableOpacity>

      <ProjectModal
        editing={editing}
        taskCount={editing?.kind === 'edit' ? countFor(editing.project.id) : 0}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </SafeAreaView>
  );
}

interface ProjectModalProps {
  editing: Editing | null;
  taskCount: number;
  onClose: () => void;
  onSaved: (p: Project, isNew: boolean) => void;
  onDeleted: (id: string) => void;
}

function ProjectModal({ editing, taskCount, onClose, onSaved, onDeleted }: ProjectModalProps) {
  const { palette, radii, spacing, fontSize } = useTheme();
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    if (editing.kind === 'edit') {
      setName(editing.project.name);
      setColor(editing.project.color ?? COLORS[0]);
    } else {
      setName('');
      setColor(COLORS[0]);
    }
    setErr(null);
  }, [editing]);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      if (editing?.kind === 'edit') {
        const updated = await api.updateProject(editing.project.id, {
          name: name.trim(),
          color,
        });
        onSaved(updated, false);
      } else {
        const created = await api.createProject(name.trim(), color);
        onSaved(created, true);
      }
      haptic.success();
      onClose();
    } catch (e) {
      haptic.warning();
      setErr(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (editing?.kind !== 'edit') return;
    const id = editing.project.id;
    const run = async () => {
      setBusy(true);
      try {
        await api.deleteProject(id);
        haptic.warning();
        onDeleted(id);
        onClose();
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to delete');
      } finally {
        setBusy(false);
      }
    };
    const message =
      taskCount > 0
        ? `This project has ${taskCount} task${taskCount === 1 ? '' : 's'} that will also be deleted. This cannot be undone.`
        : 'Delete this project? This cannot be undone.';
    if (Platform.OS === 'web') {
      // @ts-ignore
      if (window.confirm(message)) run();
      return;
    }
    Alert.alert('Delete project', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: run },
    ]);
  };

  const visible = editing !== null;
  const isEdit = editing?.kind === 'edit';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
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
              {isEdit ? 'Edit project' : 'New project'}
            </Text>
            <TouchableOpacity onPress={submit} disabled={busy || !name.trim()} hitSlop={10}>
              <Text
                style={{
                  color: !name.trim() ? palette.textTertiary : palette.accent,
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
                Name
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Personal, Work, Side project…"
                placeholderTextColor={palette.textTertiary}
                autoFocus
                style={{
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  borderWidth: 1,
                  borderRadius: radii.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.md,
                  fontSize: 15,
                  color: palette.textPrimary,
                  fontFamily: 'Inter_400Regular',
                }}
              />
            </View>
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
                Color
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                {COLORS.map((c) => {
                  const active = color === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      onPress={() => setColor(c)}
                      activeOpacity={0.7}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: c,
                        borderWidth: active ? 3 : 0,
                        borderColor: palette.textPrimary,
                      }}
                    />
                  );
                })}
              </View>
            </View>

            {isEdit && editing && (
              <>
                <View
                  style={{
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.md,
                    backgroundColor: palette.bgSecondary,
                    borderRadius: radii.md,
                  }}
                >
                  <Text
                    style={{
                      color: palette.textSecondary,
                      fontFamily: 'Inter_400Regular',
                      fontSize: fontSize.sm,
                    }}
                  >
                    {taskCount === 0
                      ? 'No tasks in this project.'
                      : `${taskCount} task${taskCount === 1 ? '' : 's'} belong to this project.`}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={confirmDelete}
                  activeOpacity={0.7}
                  style={{
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
                      fontSize: fontSize.base,
                    }}
                  >
                    Delete project
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {err && (
              <Text style={{ color: palette.danger, fontFamily: 'Inter_400Regular' }}>
                {err}
              </Text>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
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
