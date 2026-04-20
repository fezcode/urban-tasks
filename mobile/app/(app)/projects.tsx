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
import { FolderKanban, Plus, Shield, UserMinus, UserPlus, Users } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import Avatar from '@/components/Avatar';
import { api, Invitation, Member, Project, Task } from '@/api/client';
import { EmptyState } from '@/components/ui';
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
            error ? (
              <EmptyState title={error} />
            ) : (
              <EmptyState
                icon={FolderKanban}
                tone="accent"
                title="No projects yet"
                description="Group related tasks together — by client, area of life, or whatever matters to you."
                actionLabel="New project"
                onAction={() => setEditing({ kind: 'create' })}
              />
            )
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
        accessibilityRole="button"
        accessibilityLabel="New project"
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
        if (updated) onSaved(updated, false);
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

            {isEdit && editing && <MembersSection projectId={editing.project.id} />}

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

function MembersSection({ projectId }: { projectId: string }) {
  const { palette, radii, spacing, fontSize } = useTheme();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, i, u] = await Promise.all([
        api.listMembers(projectId),
        api.listProjectInvitations(projectId),
        api.me(),
      ]);
      setMembers(m);
      setInvitations(i.filter((x) => x.status === 'pending'));
      setMe(u.id);
    } catch {
      // ignore
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const isAdmin = members.some((m) => m.userId === me && m.role === 'admin');

  const invite = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const inv = await api.invite(projectId, trimmed);
      setInvitations((xs) => [inv, ...xs]);
      setEmail('');
      haptic.success();
    } catch (e: any) {
      Alert.alert('Invite', e?.message ?? 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const removeMember = (m: Member) => {
    const isSelf = m.userId === me;
    const run = async () => {
      try {
        await api.removeMember(projectId, m.userId);
        setMembers((xs) => xs.filter((x) => x.userId !== m.userId));
      } catch (e: any) {
        Alert.alert('Remove', e?.message ?? 'Failed');
      }
    };
    Alert.alert(
      isSelf ? 'Leave project' : `Remove ${m.name}`,
      isSelf ? 'You will lose access to this project.' : `Remove ${m.name} from this project?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: isSelf ? 'Leave' : 'Remove', style: 'destructive', onPress: run },
      ],
    );
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <Users size={14} color={palette.textTertiary} />
        <Text
          style={{
            color: palette.textTertiary,
            fontSize: 11,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            fontFamily: 'Inter_500Medium',
          }}
        >
          Members
        </Text>
      </View>

      {isAdmin && (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="email to invite"
            placeholderTextColor={palette.textTertiary}
            autoCapitalize="none"
            keyboardType="email-address"
            style={{
              flex: 1,
              backgroundColor: palette.surface,
              borderColor: palette.border,
              borderWidth: 1,
              borderRadius: radii.md,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm + 2,
              fontSize: 14,
              color: palette.textPrimary,
              fontFamily: 'Inter_400Regular',
            }}
          />
          <TouchableOpacity
            onPress={invite}
            disabled={busy || !email.trim()}
            activeOpacity={0.85}
            style={{
              backgroundColor: palette.accent,
              borderRadius: radii.md,
              paddingHorizontal: spacing.md,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: !email.trim() ? 0.5 : 1,
              flexDirection: 'row',
              gap: 6,
            }}
          >
            <UserPlus size={14} color={palette.textInverse} />
            <Text style={{ color: palette.textInverse, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
              Invite
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {members.map((m) => (
        <View
          key={m.userId}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.sm,
          }}
        >
          <Avatar seed={m.avatarSeed ?? m.userId} name={m.name} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.textPrimary, fontFamily: 'Inter_500Medium', fontSize: 14 }}>
              {m.name}
              {m.userId === me ? (
                <Text style={{ color: palette.textTertiary, fontSize: 11 }}>  (you)</Text>
              ) : null}
            </Text>
            <Text style={{ color: palette.textTertiary, fontFamily: 'Inter_400Regular', fontSize: 11 }}>
              {m.email}
            </Text>
          </View>
          {m.role === 'admin' && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: palette.accentLight ?? palette.surface,
              }}
            >
              <Shield size={10} color={palette.accent} />
              <Text style={{ color: palette.accent, fontFamily: 'Inter_500Medium', fontSize: 10 }}>
                admin
              </Text>
            </View>
          )}
          {(isAdmin || m.userId === me) && (
            <TouchableOpacity onPress={() => removeMember(m)} hitSlop={8} style={{ padding: 6 }}>
              <UserMinus size={16} color={palette.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      ))}

      {invitations.length > 0 && (
        <View style={{ marginTop: spacing.sm, gap: 6 }}>
          <Text
            style={{
              color: palette.textTertiary,
              fontFamily: 'Inter_500Medium',
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
            }}
          >
            Pending
          </Text>
          {invitations.map((inv) => (
            <Text
              key={inv.id}
              style={{ color: palette.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 13 }}
            >
              {inv.inviteeEmail} — expires {new Date(inv.expiresAt).toLocaleDateString()}
            </Text>
          ))}
        </View>
      )}
    </View>
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
