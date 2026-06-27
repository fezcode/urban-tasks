import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pin, Plus, Search, X, ZoomIn, ZoomOut, Locate } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { api, friendlyErrorMessage, Task, Project, PinboardBoard } from '@/api/client';
import PinboardWebView, { BoardData, PinboardWebViewHandle } from '@/components/PinboardWebView';
import { haptic } from '@/haptics';

const PRI: Record<string, string> = { high: '#d63a2f', medium: '#e0902a', low: '#3a7bd5', none: '#c0392b' };

export default function PinboardScreen() {
  const { palette, radii, spacing, fontSize } = useTheme();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [board, setBoard] = useState<PinboardBoard>({ cards: [], connections: [] });
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const webRef = useRef<PinboardWebViewHandle>(null);

  const loadProjects = useCallback(async () => {
    try {
      const ps = await api.listProjects();
      setProjects(ps);
      setProjectId((cur) => cur ?? ps[0]?.id ?? null);
    } catch {
      /* ignore */
    }
  }, []);

  const loadBoard = useCallback(async (pid: string) => {
    setLoading(true);
    try {
      const [b, ts] = await Promise.all([api.getPinboard(pid), api.listTasks(pid)]);
      setBoard(b);
      setTasks(ts);
    } catch (e) {
      // Board fails silently to an empty state; tasks may still load.
      setBoard({ cards: [], connections: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProjects();
    }, [loadProjects])
  );

  React.useEffect(() => {
    if (projectId) loadBoard(projectId);
  }, [projectId, loadBoard]);

  const taskById = useMemo(() => {
    const m = new Map<string, Task>();
    tasks.forEach((t) => m.set(t.id, t));
    return m;
  }, [tasks]);

  const pinnedIds = useMemo(() => new Set(board.cards.map((c) => c.taskId)), [board.cards]);

  const data: BoardData = useMemo(() => {
    const tmap: BoardData['tasks'] = {};
    board.cards.forEach((c) => {
      const t = taskById.get(c.taskId);
      if (t) tmap[c.taskId] = { title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate };
    });
    return {
      cards: board.cards.filter((c) => taskById.has(c.taskId)).map((c) => ({ id: c.id, taskId: c.taskId, x: c.x, y: c.y })),
      connections: board.connections.map((c) => ({ id: c.id, aTaskId: c.aTaskId, bTaskId: c.bTaskId, label: c.label })),
      tasks: tmap,
    };
  }, [board, taskById]);

  // --- mutations ---
  const onMove = useCallback((cardId: string, x: number, y: number) => {
    setBoard((b) => ({ ...b, cards: b.cards.map((c) => (c.id === cardId ? { ...c, x, y } : c)) }));
    api.movePinCard(cardId, x, y).catch(() => {});
  }, []);

  const onConnect = useCallback(
    (fromTaskId: string, toTaskId: string) => {
      if (!projectId) return;
      api
        .connectPins(projectId, fromTaskId, toTaskId)
        .then((conn) =>
          setBoard((b) => ({
            ...b,
            connections: [
              ...b.connections.filter((c) => !(c.aTaskId === conn.aTaskId && c.bTaskId === conn.bTaskId)),
              conn,
            ],
          }))
        )
        .catch((e) => friendlyErrorMessage(e));
    },
    [projectId]
  );

  const onRelabel = useCallback((connId: string, label: string) => {
    setBoard((b) => ({ ...b, connections: b.connections.map((c) => (c.id === connId ? { ...c, label } : c)) }));
    api.relabelPin(connId, label).catch(() => {});
  }, []);

  const onDisconnect = useCallback((connId: string) => {
    setBoard((b) => ({ ...b, connections: b.connections.filter((c) => c.id !== connId) }));
    api.disconnectPin(connId).catch(() => {});
  }, []);

  const onUnpin = useCallback((cardId: string) => {
    setBoard((b) => {
      const card = b.cards.find((c) => c.id === cardId);
      return {
        cards: b.cards.filter((c) => c.id !== cardId),
        connections: card
          ? b.connections.filter((c) => c.aTaskId !== card.taskId && c.bTaskId !== card.taskId)
          : b.connections,
      };
    });
    api.unpinCard(cardId).catch(() => {});
  }, []);

  const onOpen = useCallback(
    (taskId: string) => {
      router.push({ pathname: '/(app)/tasks', params: { open: taskId } });
    },
    [router]
  );

  const pinTask = useCallback(
    (taskId: string) => {
      if (!projectId) return;
      haptic.light();
      // Place near the centroid of existing notes, with a small cascade.
      let cx = 0;
      let cy = 0;
      if (board.cards.length > 0) {
        board.cards.forEach((c) => {
          cx += c.x;
          cy += c.y;
        });
        cx = cx / board.cards.length;
        cy = cy / board.cards.length;
      }
      const offset = (board.cards.length % 6) * 26;
      api
        .pinCard(projectId, taskId, cx + offset, cy + offset)
        .then((card) => setBoard((b) => ({ ...b, cards: [...b.cards.filter((c) => c.taskId !== taskId), card] })))
        .catch(() => {});
    },
    [projectId, board.cards]
  );

  const activeProject = projects.find((p) => p.id === projectId) ?? null;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm }}>
        <Pin size={20} color={palette.accent} />
        <Text style={{ flex: 1, fontFamily: 'Fraunces_600SemiBold', fontSize: fontSize.xl, color: palette.textPrimary }}>
          Pinboard
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: palette.bgSecondary, borderRadius: radii.md }}>
          <TouchableOpacity onPress={() => webRef.current?.zoomOut()} style={{ padding: 8 }}>
            <ZoomOut size={16} color={palette.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => webRef.current?.reset()} style={{ padding: 8 }}>
            <Locate size={16} color={palette.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => webRef.current?.zoomIn()} style={{ padding: 8 }}>
            <ZoomIn size={16} color={palette.textSecondary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => setPickerOpen(true)}
          disabled={!projectId}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: palette.accent, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.md, opacity: projectId ? 1 : 0.4 }}
        >
          <Plus size={15} color={palette.textInverse} />
          <Text style={{ color: palette.textInverse, fontFamily: 'Inter_600SemiBold', fontSize: fontSize.sm }}>Pin</Text>
        </TouchableOpacity>
      </View>

      {/* Project selector */}
      {projects.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm }}>
          {projects.map((p) => {
            const active = p.id === projectId;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => setProjectId(p.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: radii.pill,
                  backgroundColor: active ? palette.accent : palette.surface,
                  borderWidth: 1,
                  borderColor: active ? palette.accent : palette.border,
                }}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.color ?? palette.textTertiary }} />
                <Text style={{ color: active ? palette.textInverse : palette.textPrimary, fontFamily: 'Inter_500Medium', fontSize: fontSize.sm }}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Board */}
      <View style={{ flex: 1, overflow: 'hidden' }}>
        {!projectId ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
            <Pin size={26} color={palette.textTertiary} />
            <Text style={{ marginTop: 10, color: palette.textSecondary, fontFamily: 'Inter_600SemiBold', fontSize: fontSize.md }}>No project</Text>
            <Text style={{ marginTop: 4, color: palette.textTertiary, fontSize: fontSize.sm, textAlign: 'center' }}>
              Create a project to start a corkboard.
            </Text>
          </View>
        ) : (
          <>
            <PinboardWebView
              ref={webRef}
              data={data}
              onMove={onMove}
              onConnect={onConnect}
              onRelabel={onRelabel}
              onDisconnect={onDisconnect}
              onUnpin={onUnpin}
              onOpen={onOpen}
            />
            {loading && (
              <View style={{ position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={{ color: '#fff', fontSize: 12 }}>Loading…</Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* Pin-tasks picker */}
      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: palette.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '78%', paddingBottom: Platform.OS === 'ios' ? 28 : 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: palette.borderLight }}>
              <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: fontSize.lg, color: palette.textPrimary }}>Pin tasks</Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)}>
                <X size={20} color={palette.textTertiary} />
              </TouchableOpacity>
            </View>
            <PinPickerList
              tasks={tasks.filter((t) => !pinnedIds.has(t.id))}
              onPin={(id) => pinTask(id)}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function PinPickerList({ tasks, onPin }: { tasks: Task[]; onPin: (id: string) => void }) {
  const { palette, spacing, fontSize, radii } = useTheme();
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? tasks.filter((t) => t.title.toLowerCase().includes(needle)) : tasks;
  }, [tasks, q]);

  return (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: palette.bgSecondary, borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 8, marginHorizontal: spacing.xs }}>
        <Search size={15} color={palette.textTertiary} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search tasks…"
          placeholderTextColor={palette.textTertiary}
          style={{ flex: 1, color: palette.textPrimary, fontSize: fontSize.base, padding: 0 }}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(t) => t.id}
        style={{ marginTop: spacing.sm }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: palette.textTertiary, fontSize: fontSize.sm, paddingVertical: 30 }}>
            {tasks.length === 0 ? 'Every task is already pinned.' : 'No matching tasks.'}
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => onPin(item.id)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: spacing.sm }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PRI[item.priority ?? 'none'] }} />
            <Text numberOfLines={1} style={{ flex: 1, color: palette.textPrimary, fontSize: fontSize.base }}>{item.title}</Text>
            <Plus size={16} color={palette.textTertiary} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
