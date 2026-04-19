import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronRight, Download, Moon, Shuffle, Sun, Upload } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { api, clearToken, User } from '@/api/client';
import { haptic } from '@/haptics';

const AVATAR_SEEDS = ['atlas', 'ember', 'felix', 'ivy', 'june', 'kai', 'lumen', 'nico', 'orin', 'piper'];

export default function Profile() {
  const { palette, radii, spacing, fontSize, mode, toggle } = useTheme();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState<null | 'export' | 'import'>(null);
  const [dataText, setDataText] = useState('');
  const [dataBusy, setDataBusy] = useState(false);
  const [dataMsg, setDataMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setUser(await api.me());
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signOut = async () => {
    await clearToken();
    router.replace('/');
  };

  const confirmDelete = () => {
    const run = async () => {
      try {
        await api.deleteMe();
        await clearToken();
        haptic.warning();
        router.replace('/');
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete account');
      }
    };
    const message = 'This permanently deletes your account and all data. This cannot be undone.';
    if (Platform.OS === 'web') {
      // @ts-ignore
      if (window.confirm(message)) run();
      return;
    }
    Alert.alert('Delete account', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: run },
    ]);
  };

  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();

  const startExport = async () => {
    setDataBusy(true);
    setDataMsg(null);
    setDataText('');
    setDataOpen('export');
    try {
      const [projects, tasks] = await Promise.all([api.listProjects(), api.listTasks()]);
      const payload = {
        exportedAt: new Date().toISOString(),
        version: 1,
        projects,
        tasks,
      };
      const json = JSON.stringify(payload, null, 2);
      setDataText(json);
      if (Platform.OS === 'web') {
        try {
          // @ts-ignore navigator types vary
          await navigator.clipboard?.writeText(json);
          setDataMsg({ kind: 'ok', text: 'Copied to clipboard.' });
        } catch {
          setDataMsg({ kind: 'ok', text: 'Select and copy the JSON below.' });
        }
      } else {
        setDataMsg({ kind: 'ok', text: 'Long-press to select and copy.' });
      }
    } catch (e) {
      setDataMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Export failed' });
    } finally {
      setDataBusy(false);
    }
  };

  const startImport = () => {
    setDataText('');
    setDataMsg(null);
    setDataOpen('import');
  };

  const runImport = async () => {
    setDataBusy(true);
    setDataMsg(null);
    try {
      const parsed = JSON.parse(dataText);
      const projects: any[] = Array.isArray(parsed?.projects) ? parsed.projects : [];
      const tasks: any[] = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
      const idMap = new Map<string, string>();
      for (const p of projects) {
        if (!p?.name) continue;
        const created = await api.createProject(String(p.name), String(p.color ?? '#c96442'));
        if (p.id) idMap.set(String(p.id), created.id);
      }
      let imported = 0;
      for (const t of tasks) {
        if (!t?.title || !t?.projectId) continue;
        const pid = idMap.get(String(t.projectId));
        if (!pid) continue;
        const created = await api.createTask({
          projectId: pid,
          title: String(t.title),
          body: t.body ? String(t.body) : undefined,
          priority: t.priority,
        });
        const patch: any = {};
        if (t.dueDate) patch.dueDate = String(t.dueDate).slice(0, 10);
        if (t.startDate) patch.startDate = String(t.startDate).slice(0, 10);
        if (Array.isArray(t.tags)) patch.tags = t.tags.map(String);
        if (t.status && t.status !== 'todo') patch.status = t.status;
        if (Object.keys(patch).length) await api.updateTask(created.id, patch);
        imported++;
      }
      haptic.success();
      setDataMsg({
        kind: 'ok',
        text: `Imported ${projects.length} projects and ${imported} tasks.`,
      });
    } catch (e) {
      haptic.warning();
      setDataMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Invalid JSON' });
    } finally {
      setDataBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: palette.bg }]}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        <View style={{ alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: palette.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: palette.textInverse,
                fontSize: 34,
                fontFamily: 'Fraunces_600SemiBold',
              }}
            >
              {initial}
            </Text>
          </View>
          {loading ? (
            <ActivityIndicator color={palette.accent} />
          ) : (
            <>
              <Text
                style={{
                  color: palette.textPrimary,
                  fontSize: 22,
                  fontFamily: 'Fraunces_600SemiBold',
                  letterSpacing: -0.3,
                }}
              >
                {user?.name || 'Signed in'}
              </Text>
              {user?.email && (
                <Text
                  style={{
                    color: palette.textSecondary,
                    fontSize: fontSize.sm,
                    fontFamily: 'Inter_400Regular',
                    marginTop: -spacing.sm,
                  }}
                >
                  {user.email}
                </Text>
              )}
              <TouchableOpacity
                onPress={() => setEditOpen(true)}
                activeOpacity={0.8}
                style={{
                  marginTop: spacing.xs,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  borderColor: palette.border,
                }}
              >
                <Text
                  style={{
                    color: palette.textPrimary,
                    fontFamily: 'Inter_500Medium',
                    fontSize: fontSize.sm,
                  }}
                >
                  Edit profile
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={{ gap: spacing.sm }}>
          <SectionLabel>Preferences</SectionLabel>
          <Row
            label="Theme"
            value={mode === 'dark' ? 'Dark' : 'Light'}
            icon={mode === 'dark' ? <Moon size={16} color={palette.textSecondary} /> : <Sun size={16} color={palette.textSecondary} />}
            onPress={toggle}
          />
        </View>

        <View style={{ gap: spacing.sm }}>
          <SectionLabel>Data</SectionLabel>
          <Row
            label="Export"
            icon={<Download size={16} color={palette.textSecondary} />}
            onPress={startExport}
          />
          <Row
            label="Import"
            icon={<Upload size={16} color={palette.textSecondary} />}
            onPress={startImport}
          />
        </View>

        <View style={{ gap: spacing.sm }}>
          <SectionLabel>Account</SectionLabel>
          <Row label="Sign out" onPress={signOut} />
          <Row label="Delete account" destructive onPress={confirmDelete} />
        </View>
      </ScrollView>

      <Text
        style={{
          textAlign: 'center',
          color: palette.textTertiary,
          fontFamily: 'Fraunces_400Regular',
          fontSize: fontSize.sm,
          paddingBottom: spacing.xl,
        }}
      >
        urban tasks · mobile
      </Text>

      <EditProfileModal
        visible={editOpen}
        user={user}
        onClose={() => setEditOpen(false)}
        onSaved={(u) => {
          setUser(u);
          setEditOpen(false);
        }}
      />

      <DataModal
        mode={dataOpen}
        text={dataText}
        onChangeText={setDataText}
        busy={dataBusy}
        message={dataMsg}
        onConfirmImport={runImport}
        onClose={() => {
          setDataOpen(null);
          setDataMsg(null);
          setDataText('');
        }}
      />
    </SafeAreaView>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const { palette, fontSize } = useTheme();
  return (
    <Text
      style={{
        color: palette.textTertiary,
        fontSize: fontSize['2xs'],
        letterSpacing: 2,
        textTransform: 'uppercase',
        fontFamily: 'Inter_500Medium',
        marginLeft: 4,
      }}
    >
      {children}
    </Text>
  );
}

function Row({
  label,
  value,
  icon,
  onPress,
  destructive,
}: {
  label: string;
  value?: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
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
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      }}
    >
      {icon}
      <Text
        style={{
          flex: 1,
          color: destructive ? palette.danger : palette.textPrimary,
          fontSize: fontSize.base,
          fontFamily: 'Inter_500Medium',
        }}
      >
        {label}
      </Text>
      {value && (
        <Text
          style={{
            color: palette.textTertiary,
            fontFamily: 'Inter_400Regular',
            fontSize: fontSize.sm,
          }}
        >
          {value}
        </Text>
      )}
      {onPress && !destructive && (
        <ChevronRight size={16} color={palette.textTertiary} />
      )}
    </TouchableOpacity>
  );
}

function EditProfileModal({
  visible,
  user,
  onClose,
  onSaved,
}: {
  visible: boolean;
  user: User | null;
  onClose: () => void;
  onSaved: (u: User) => void;
}) {
  const { palette, radii, spacing, fontSize } = useTheme();
  const [name, setName] = useState('');
  const [seed, setSeed] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !user) return;
    setName(user.name ?? '');
    setSeed(user.avatarSeed ?? '');
    setErr(null);
  }, [visible, user]);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const updated = await api.updateMe({
        name: name.trim(),
        avatarSeed: seed.trim() || undefined,
      });
      haptic.success();
      if (updated) onSaved(updated);
    } catch (e) {
      haptic.warning();
      setErr(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  const randomSeed = () => {
    const next = AVATAR_SEEDS[Math.floor(Math.random() * AVATAR_SEEDS.length)];
    setSeed(next);
  };

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
              Edit profile
            </Text>
            <TouchableOpacity onPress={save} disabled={busy || !name.trim()} hitSlop={10}>
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

          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
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
                placeholder="Your name"
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
                  Avatar seed
                </Text>
                <TouchableOpacity
                  onPress={randomSeed}
                  hitSlop={8}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Shuffle size={12} color={palette.accent} />
                  <Text
                    style={{
                      color: palette.accent,
                      fontSize: 12,
                      fontFamily: 'Inter_500Medium',
                    }}
                  >
                    Random
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                value={seed}
                onChangeText={setSeed}
                placeholder="A word that shapes your avatar"
                placeholderTextColor={palette.textTertiary}
                autoCapitalize="none"
                autoCorrect={false}
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
              <Text
                style={{
                  color: palette.textTertiary,
                  fontSize: fontSize.xs,
                  fontFamily: 'Inter_400Regular',
                }}
              >
                A short word that (eventually) deterministically generates your avatar.
              </Text>
            </View>

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

function DataModal({
  mode,
  text,
  onChangeText,
  busy,
  message,
  onConfirmImport,
  onClose,
}: {
  mode: null | 'export' | 'import';
  text: string;
  onChangeText: (s: string) => void;
  busy: boolean;
  message: { kind: 'ok' | 'err'; text: string } | null;
  onConfirmImport: () => void;
  onClose: () => void;
}) {
  const { palette, radii, spacing, fontSize } = useTheme();
  const isExport = mode === 'export';
  const title = isExport ? 'Export data' : 'Import data';

  return (
    <Modal
      visible={mode !== null}
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
                Close
              </Text>
            </TouchableOpacity>
            <Text
              style={{
                color: palette.textPrimary,
                fontSize: 16,
                fontFamily: 'Fraunces_600SemiBold',
              }}
            >
              {title}
            </Text>
            {!isExport ? (
              <TouchableOpacity
                onPress={onConfirmImport}
                disabled={busy || !text.trim()}
                hitSlop={10}
              >
                <Text
                  style={{
                    color: !text.trim() ? palette.textTertiary : palette.accent,
                    fontSize: 15,
                    fontFamily: 'Inter_600SemiBold',
                    opacity: busy ? 0.5 : 1,
                  }}
                >
                  {busy ? 'Working…' : 'Import'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 48 }} />
            )}
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
            <Text
              style={{
                color: palette.textSecondary,
                fontFamily: 'Inter_400Regular',
                fontSize: fontSize.sm,
                lineHeight: 20,
              }}
            >
              {isExport
                ? 'A JSON snapshot of your projects and tasks. Save it somewhere safe — paste it into Import on any device to restore.'
                : 'Paste a previously exported JSON payload. Existing data is kept; imported items are added alongside.'}
            </Text>

            {message && (
              <View
                style={{
                  padding: spacing.md,
                  borderRadius: radii.md,
                  backgroundColor:
                    message.kind === 'ok' ? palette.accentLight : palette.dangerBg,
                }}
              >
                <Text
                  style={{
                    color: message.kind === 'ok' ? palette.accent : palette.danger,
                    fontFamily: 'Inter_500Medium',
                    fontSize: fontSize.sm,
                  }}
                >
                  {message.text}
                </Text>
              </View>
            )}

            <TextInput
              value={text}
              onChangeText={onChangeText}
              editable={!isExport && !busy}
              multiline
              placeholder={isExport ? '' : 'Paste JSON here…'}
              placeholderTextColor={palette.textTertiary}
              style={{
                backgroundColor: palette.surface,
                borderColor: palette.border,
                borderWidth: 1,
                borderRadius: radii.md,
                padding: spacing.md,
                fontSize: 12,
                color: palette.textPrimary,
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                minHeight: 240,
                textAlignVertical: 'top',
              }}
              autoCapitalize="none"
              autoCorrect={false}
              selectTextOnFocus={isExport}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
