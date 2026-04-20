import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { BellRing, Check, Mail, X, CheckCheck, Inbox as InboxIcon } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeContext';
import { api, Invitation, Notification } from '@/api/client';
import { EmptyState } from '@/components/ui';

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

function timeTo(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h`;
  const d = Math.floor(h / 24);
  return `in ${d}d`;
}

function formatNotification(n: Notification): string {
  const p = n.payload || {};
  switch (n.kind) {
    case 'invitation_received':
      return `${p.inviterName ?? 'Someone'} invited you to ${p.projectName ?? 'a project'}`;
    case 'invitation_accepted':
      return `${p.inviteeName ?? p.inviteeEmail ?? 'Someone'} joined ${p.projectName ?? 'your project'}`;
    case 'invitation_rejected':
      return `${p.inviteeName ?? p.inviteeEmail ?? 'Someone'} declined ${p.projectName ?? 'your invitation'}`;
    default:
      return n.kind.replace(/_/g, ' ');
  }
}

export default function InboxScreen() {
  const { palette, radii, spacing, fontSize } = useTheme();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [invs, n] = await Promise.all([
        api.listMyInvitations(),
        api.listNotifications(),
      ]);
      setInvitations(invs);
      setNotifications(n.items);
    } catch (e: any) {
      Alert.alert('Inbox', e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const respond = async (inv: Invitation, accept: boolean) => {
    try {
      if (accept) await api.acceptInvitation(inv.id);
      else await api.rejectInvitation(inv.id);
      setInvitations((xs) => xs.filter((x) => x.id !== inv.id));
    } catch (e: any) {
      Alert.alert('Invitation', e?.message ?? 'Failed');
    }
  };

  const markRead = async (n: Notification) => {
    if (n.readAt) return;
    try {
      await api.markNotificationRead(n.id);
      setNotifications((xs) =>
        xs.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
      );
    } catch {
      // ignore
    }
  };

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((xs) => xs.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
    } catch (e: any) {
      Alert.alert('Inbox', e?.message ?? 'Failed');
    }
  };

  const unread = notifications.filter((n) => !n.readAt).length;

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.bg }}>
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <Text style={{ color: palette.textPrimary, fontFamily: 'Fraunces_600SemiBold', fontSize: 26, flex: 1 }}>
          Inbox
        </Text>
        {unread > 0 && (
          <Pressable
            onPress={markAllRead}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: spacing.sm }}
          >
            <CheckCheck size={16} color={palette.textSecondary} />
            <Text style={{ color: palette.textSecondary, fontFamily: 'Inter_500Medium', fontSize: fontSize.sm }}>
              Mark all read
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView
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
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl * 3 }}
      >
        {invitations.length === 0 && notifications.length === 0 ? (
          <EmptyState
            icon={InboxIcon}
            tone="accent"
            title="Nothing new"
            description="Invitations and notifications will appear here."
          />
        ) : null}

        {invitations.length > 0 && (
          <>
            <Text
              style={{
                color: palette.textTertiary,
                fontFamily: 'Inter_500Medium',
                fontSize: 11,
                letterSpacing: 2,
                textTransform: 'uppercase',
                marginBottom: spacing.sm,
              }}
            >
              Invitations
            </Text>
            {invitations.map((inv) => (
              <View
                key={inv.id}
                style={{
                  backgroundColor: palette.surface,
                  borderColor: palette.borderLight,
                  borderWidth: 1,
                  borderRadius: radii.lg,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: (inv.projectColor ?? palette.accent) + '22',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Mail size={16} color={inv.projectColor ?? palette.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.textPrimary, fontFamily: 'Inter_500Medium', fontSize: fontSize.sm }}>
                    <Text style={{ fontWeight: '600' }}>{inv.inviterName ?? 'Someone'}</Text>
                    {' invited you to '}
                    <Text style={{ fontWeight: '600' }}>{inv.projectName ?? 'a project'}</Text>
                  </Text>
                  <Text style={{ color: palette.textTertiary, fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 }}>
                    Expires {timeTo(inv.expiresAt)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => respond(inv, true)}
                  style={{ padding: 8, borderRadius: 8 }}
                  hitSlop={6}
                >
                  <Check size={18} color={palette.accent} />
                </Pressable>
                <Pressable
                  onPress={() => respond(inv, false)}
                  style={{ padding: 8, borderRadius: 8 }}
                  hitSlop={6}
                >
                  <X size={18} color={palette.textTertiary} />
                </Pressable>
              </View>
            ))}
          </>
        )}

        {notifications.length > 0 && (
          <>
            <Text
              style={{
                color: palette.textTertiary,
                fontFamily: 'Inter_500Medium',
                fontSize: 11,
                letterSpacing: 2,
                textTransform: 'uppercase',
                marginTop: invitations.length > 0 ? spacing.lg : 0,
                marginBottom: spacing.sm,
              }}
            >
              Notifications
            </Text>
            {notifications.map((n) => (
              <Pressable
                key={n.id}
                onPress={() => markRead(n)}
                style={{
                  backgroundColor: n.readAt ? palette.surface : (palette.accentLight ?? palette.surface),
                  borderColor: palette.borderLight,
                  borderWidth: 1,
                  borderRadius: radii.lg,
                  padding: spacing.md,
                  marginBottom: spacing.xs,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: spacing.sm,
                  opacity: n.readAt ? 0.7 : 1,
                }}
              >
                <BellRing size={16} color={n.readAt ? palette.textTertiary : palette.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.textPrimary, fontFamily: 'Inter_400Regular', fontSize: fontSize.sm }}>
                    {formatNotification(n)}
                  </Text>
                  <Text style={{ color: palette.textTertiary, fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 2 }}>
                    {timeAgo(n.createdAt)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
