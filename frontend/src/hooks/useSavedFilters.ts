import { useCallback, useEffect, useState } from 'react';
import * as api from '../api/client';

export function useSavedFilters() {
  const [items, setItems] = useState<api.SavedFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!api.hasTokens()) return;
    setLoading(true);
    try {
      const list = await api.savedFilters.list();
      setItems(list ?? []);
      setError(null);
    } catch (e) {
      setError(api.friendlyErrorMessage(e, 'Failed to load saved filters'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, error, refresh };
}
