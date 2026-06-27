import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../api/client';
import { useToast } from '../context/ToastContext';
import type { PinboardCard, PinboardConnection } from '../context/types';
import { connectionKey, pairKey } from '../lib/board';

// usePinboard owns a single project's board state (pinned cards + string),
// with optimistic local updates that roll back + toast on API failure.
export function usePinboard(projectId: string | null) {
  const { error: toastError } = useToast();
  const [cards, setCards] = useState<PinboardCard[]>([]);
  const [connections, setConnections] = useState<PinboardConnection[]>([]);
  const [bgColor, setBgColor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Refs mirror state so callbacks can read current values without re-binding.
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const connsRef = useRef(connections);
  connsRef.current = connections;

  const load = useCallback(async () => {
    if (!projectId) {
      setCards([]);
      setConnections([]);
      setBgColor(null);
      return;
    }
    setLoading(true);
    try {
      const board = await api.pinboard.get(projectId);
      setCards(board.cards || []);
      setConnections(board.connections || []);
      setBgColor(board.bgColor ?? null);
    } catch (e) {
      toastError(api.friendlyErrorMessage(e, 'Failed to load board'));
    } finally {
      setLoading(false);
    }
  }, [projectId, toastError]);

  useEffect(() => {
    void load();
  }, [load]);

  const pin = useCallback(
    async (taskId: string, x: number, y: number) => {
      if (!projectId) return;
      try {
        const card = await api.pinboard.pinCard(projectId, taskId, x, y);
        setCards((cs) => [...cs.filter((c) => c.taskId !== taskId), card]);
      } catch (e) {
        toastError(api.friendlyErrorMessage(e, 'Could not pin task'));
      }
    },
    [projectId, toastError]
  );

  // Immediate local move during a drag — no network.
  const moveLocal = useCallback((cardId: string, x: number, y: number) => {
    setCards((cs) => cs.map((c) => (c.id === cardId ? { ...c, x, y } : c)));
  }, []);

  // Persist a card's final position (called on drop).
  const commitMove = useCallback(
    async (cardId: string, x: number, y: number) => {
      moveLocal(cardId, x, y);
      try {
        await api.pinboard.moveCard(cardId, x, y);
      } catch (e) {
        toastError(api.friendlyErrorMessage(e, 'Could not save position'));
        void load();
      }
    },
    [moveLocal, toastError, load]
  );

  const recolorCard = useCallback(
    async (cardId: string, color: string) => {
      // Empty string clears back to auto (priority color).
      setCards((cs) => cs.map((c) => (c.id === cardId ? { ...c, color: color || null } : c)));
      try {
        await api.pinboard.recolorCard(cardId, color);
      } catch (e) {
        toastError(api.friendlyErrorMessage(e, 'Could not recolor note'));
        void load();
      }
    },
    [toastError, load]
  );

  const setBoardBgColor = useCallback(
    async (color: string) => {
      if (!projectId) return;
      const prev = bgColor;
      setBgColor(color || null);
      try {
        await api.pinboard.setBoardColor(projectId, color);
      } catch (e) {
        toastError(api.friendlyErrorMessage(e, 'Could not set board color'));
        setBgColor(prev);
      }
    },
    [projectId, bgColor, toastError]
  );

  const unpin = useCallback(
    async (cardId: string) => {
      const card = cardsRef.current.find((c) => c.id === cardId);
      setCards((cs) => cs.filter((c) => c.id !== cardId));
      if (card) {
        setConnections((conns) =>
          conns.filter((c) => c.aTaskId !== card.taskId && c.bTaskId !== card.taskId)
        );
      }
      try {
        await api.pinboard.unpinCard(cardId);
      } catch (e) {
        toastError(api.friendlyErrorMessage(e, 'Could not unpin task'));
        void load();
      }
    },
    [toastError, load]
  );

  const connect = useCallback(
    async (fromTaskId: string, toTaskId: string, label = '') => {
      if (!projectId || fromTaskId === toTaskId) return;
      // Ignore if this exact pair already has a string.
      const key = pairKey(fromTaskId, toTaskId);
      if (connsRef.current.some((c) => connectionKey(c) === key)) return;
      try {
        const conn = await api.pinboard.connect(projectId, fromTaskId, toTaskId, label);
        setConnections((cs) => [...cs.filter((c) => connectionKey(c) !== connectionKey(conn)), conn]);
      } catch (e) {
        toastError(api.friendlyErrorMessage(e, 'Could not connect tasks'));
      }
    },
    [projectId, toastError]
  );

  const relabel = useCallback(
    async (connId: string, label: string) => {
      setConnections((cs) => cs.map((c) => (c.id === connId ? { ...c, label } : c)));
      try {
        await api.pinboard.relabel(connId, label);
      } catch (e) {
        toastError(api.friendlyErrorMessage(e, 'Could not update label'));
        void load();
      }
    },
    [toastError, load]
  );

  const disconnect = useCallback(
    async (connId: string) => {
      setConnections((cs) => cs.filter((c) => c.id !== connId));
      try {
        await api.pinboard.disconnect(connId);
      } catch (e) {
        toastError(api.friendlyErrorMessage(e, 'Could not remove string'));
        void load();
      }
    },
    [toastError, load]
  );

  return {
    cards,
    connections,
    bgColor,
    loading,
    reload: load,
    pin,
    moveLocal,
    commitMove,
    recolorCard,
    setBoardBgColor,
    unpin,
    connect,
    relabel,
    disconnect,
  };
}
