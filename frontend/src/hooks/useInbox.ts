import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';

export function useInbox() {
  const [unread, setUnread] = useState(0);
  const [pendingInvites, setPendingInvites] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [n, invs] = await Promise.all([
        api.notifications.list(),
        api.invitations.listMine(),
      ]);
      setUnread(n.unread);
      setPendingInvites(invs.length);
    } catch {
      // ignore — user may be offline / logged out
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  return { unread, pendingInvites, badge: unread + pendingInvites, refresh };
}
