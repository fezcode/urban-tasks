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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { api, Project, Task } from '@/api/client';

const COLORS = [
  '#c96442',
  '#d2af5a',
  '#5b8a72',
  '#4f7fa8',
  '#8b5a9f',
  '#c7545a',
  '#6e7785',
];

export default function ProjectsScreen() {
  const { palette, radii, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [busy, setBusy] = useState(false);

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

  const createProject = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const p = await api.createProject(newName.trim(), newColor);
      setProjects((prev) => [...prev, p]);
      setNewName('');
      setNewColor(COLORS[0]);
      setCreating(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setBusy(false);
    }
  };

  const countFor = (id: string) => tasks.filter((t) => t.projectId === id).length;
  const openFor = (id: string) =>
    tasks.filter((t) => t.projectId === id && t.status !== 'done').length;

  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.flex, { backgroundColor: palette.bg }]}
    >
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
            <View
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
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: item.color ?? palette.accent,
                }}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: palette.textPrimary,
                    fontSize: 15,
                    fontFamily: 'Inter_500Medium',
                  }}
                >
                  {item.name}
                </Text>
                <Text
                  style={{
                    color: palette.textTertiary,
                    fontSize: 12,
                    fontFamily: 'Inter_400Regular',
                    marginTop: 2,
                  }}
                >
                  {openFor(item.id)} open · {countFor(item.id)} total
                </Text>
              </View>
            </View>
          )}
        />
      )}

      <TouchableOpacity
        onPress={() => setCreating(true)}
        activeOpacity={0.85}
        style={[
          styles.fab,
          { backgroundColor: palette.accent, bottom: insets.bottom + 80 },
        ]}
      >
        <Text style={{ color: palette.textInverse, fontSize: 30, marginTop: -2 }}>
          +
        </Text>
      </TouchableOpacity>

      <Modal
        visible={creating}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCreating(false)}
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
              <TouchableOpacity onPress={() => setCreating(false)} hitSlop={10}>
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
                New project
              </Text>
              <TouchableOpacity
                onPress={createProject}
                disabled={busy || !newName.trim()}
                hitSlop={10}
              >
                <Text
                  style={{
                    color: !newName.trim() ? palette.textTertiary : palette.accent,
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
                  value={newName}
                  onChangeText={setNewName}
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
                    const active = newColor === c;
                    return (
                      <TouchableOpacity
                        key={c}
                        onPress={() => setNewColor(c)}
                        activeOpacity={0.7}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: c,
                          borderWidth: active ? 3 : 0,
                          borderColor: palette.textPrimary,
                        }}
                      />
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
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
