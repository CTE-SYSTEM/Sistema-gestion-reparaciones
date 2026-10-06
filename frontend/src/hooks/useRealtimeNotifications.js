import { useEffect, useRef, useState } from 'react';
import { createNotificationsSocket } from '../services/notificationsSocket';
import api from '../services/api';
import { mergeNotifications, reconcileNotifications } from '../utils/notificationInbox';

const DEFAULT_MAX_NOTIFICATIONS = 25;

const playNotificationSound = async () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    if (audioContext.state === 'suspended') {
      await audioContext.resume().catch(() => {});
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const startedAt = audioContext.currentTime;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, startedAt);
    oscillator.frequency.exponentialRampToValueAtTime(1170, startedAt + 0.12);
    gainNode.gain.setValueAtTime(0.0001, startedAt);
    gainNode.gain.exponentialRampToValueAtTime(0.18, startedAt + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.36);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(startedAt);
    oscillator.stop(startedAt + 0.38);
    oscillator.onended = () => audioContext.close().catch(() => {});
  } catch (error) {
    console.warn('No se pudo reproducir el sonido de notificacion:', error);
  }
};

const maybeShowBrowserNotification = (notification) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (window.Notification.permission !== 'granted') return;

  try {
    const browserNotification = new window.Notification(notification?.title || 'Notificacion', {
      body: notification?.message || '',
      tag: notification?.id || notification?.type || 'sgr-notificacion',
      icon: '/favicon.ico',
    });

    window.setTimeout(() => browserNotification.close(), 5000);
  } catch (error) {
    console.warn('No se pudo mostrar la notificacion del navegador:', error);
  }
};

export const useRealtimeNotifications = ({
  enabled = true, onNotification, onRefresh, refreshIntervalMs = 60000,
  maxNotifications = DEFAULT_MAX_NOTIFICATIONS, refreshOnConnect = false,
  refreshOnlyDisconnected = false, persistent = true,
} = {}) => {
  const [inbox, setInbox] = useState({ items: [], total: 0 });
  const [latestNotification, setLatestNotification] = useState(null);
  const [connected, setConnected] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const [clearing, setClearing] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const reloadRef = useRef();
  const revisionRef = useRef(0), loadRequestRef = useRef(0);
  const sequenceRef = useRef(0), arrivalsRef = useRef(new Map()), readIdsRef = useRef(new Set()), seenIdsRef = useRef(new Set());
  const onNotificationRef = useRef(onNotification), onRefreshRef = useRef(onRefresh);
  useEffect(() => { onNotificationRef.current = onNotification; }, [onNotification]);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  useEffect(() => {
    setInbox({ items: [], total: 0 }); setLatestNotification(null); setConnected(false); setNotificationsError('');
    arrivalsRef.current.clear(); readIdsRef.current.clear(); seenIdsRef.current.clear();
    if (!enabled) return undefined;
    let active = true;
    const loadHistory = async () => {
      if (!persistent) return;
      const revision = revisionRef.current, request = ++loadRequestRef.current, sequence = sequenceRef.current;
      setLoadingHistory(true);
      try {
        const response = await api.get('/notificaciones', { cache: false });
        if (!active || revision !== revisionRef.current || request !== loadRequestRef.current) return;
        const history = response.data.data || [];
        const arrivals = [...arrivalsRef.current.values()].filter((entry) => entry.sequence > sequence).map((entry) => entry.notification);
        const items = reconcileNotifications(history, arrivals, readIdsRef.current, maxNotifications);
        const historyIds = new Set(history.map((item) => item.id));
        const extra = arrivals.filter((item) => !historyIds.has(item.id) && !readIdsRef.current.has(item.id)).length;
        items.forEach((item) => seenIdsRef.current.add(item.id));
        setInbox({ items, total: Math.max(items.length, Number(response.data.total ?? history.length) + extra) });
        setNotificationsError('');
      } catch {
        if (active && request === loadRequestRef.current) setNotificationsError('No se pudieron recuperar los avisos pendientes. Abre la bandeja para reintentar.');
      } finally { if (active && request === loadRequestRef.current) setLoadingHistory(false); }
    };
    reloadRef.current = loadHistory;
    loadHistory();
    const onVisible = () => { if (!document.hidden) loadHistory(); };
    window.addEventListener('focus', onVisible); document.addEventListener('visibilitychange', onVisible);
    // También sincroniza lecturas hechas desde otra pestaña y recupera avisos sin socket.
    const poll = persistent ? window.setInterval(onVisible, 60000) : null;
    const socket = createNotificationsSocket();
    socket?.on('connect', () => { if (!active) return; setConnected(true); loadHistory(); if (refreshOnConnect) onRefreshRef.current?.(); });
    socket?.on('disconnect', () => { if (active) setConnected(false); });
    socket?.on('connect_error', () => { if (active) setConnected(false); });
    socket?.on('notificacion', (notification) => {
      if (!active || seenIdsRef.current.has(notification.id) || readIdsRef.current.has(notification.id)) return;
      seenIdsRef.current.add(notification.id);
      arrivalsRef.current.set(notification.id, { notification, sequence: ++sequenceRef.current });
      setInbox((previous) => ({ items: mergeNotifications([notification], previous.items, maxNotifications), total: previous.total + 1 }));
      setLatestNotification(notification);
      playNotificationSound(); maybeShowBrowserNotification(notification);
      onNotificationRef.current?.(notification); onRefreshRef.current?.(notification);
    });
    return () => {
      active = false; reloadRef.current = undefined; revisionRef.current++; loadRequestRef.current++;
      window.removeEventListener('focus', onVisible); document.removeEventListener('visibilitychange', onVisible);
      if (poll) window.clearInterval(poll);
      socket?.disconnect();
    };
  }, [enabled, maxNotifications, refreshOnConnect, persistent]);

  useEffect(() => {
    if (!latestNotification) return undefined;
    const timer = window.setTimeout(() => setLatestNotification(null), 12000);
    return () => window.clearTimeout(timer);
  }, [latestNotification]);

  useEffect(() => {
    if (!enabled || !refreshIntervalMs) return undefined;
    const interval = window.setInterval(() => {
      if (document.hidden || (refreshOnlyDisconnected && connected)) return;
      onRefreshRef.current?.();
    }, refreshIntervalMs);
    return () => window.clearInterval(interval);
  }, [enabled, refreshIntervalMs, refreshOnlyDisconnected, connected]);

  const markRead = async (ids) => {
    if (clearing || !ids.length) return false;
    setClearing(true);
    try {
      const response = persistent ? await api.patch('/notificaciones/leidas', { ids }) : null;
      revisionRef.current++;
      ids.forEach((id) => { readIdsRef.current.add(id); arrivalsRef.current.delete(id); });
      setInbox((previous) => ({ items: previous.items.filter((item) => !ids.includes(item.id)), total: Math.max(0, previous.total - (response?.data.data.leidas ?? ids.length)) }));
      setLatestNotification((previous) => ids.includes(previous?.id) ? null : previous);
      setNotificationsError('');
      await reloadRef.current?.();
      return true;
    } catch { setNotificationsError('No se pudieron marcar los avisos como leídos. Intenta de nuevo.'); return false; }
    finally { setClearing(false); }
  };
  return {
    notifications: inbox.items, unreadCount: inbox.total, connected, latestNotification, notificationsError, clearing, loadingHistory,
    clearNotifications: () => markRead(inbox.items.map((item) => item.id)),
    markNotificationRead: (id) => markRead([id]),
    dismissLatest: () => setLatestNotification(null),
    reloadNotifications: () => reloadRef.current?.(),
    setNotifications: (value) => setInbox((previous) => { const items = typeof value === 'function' ? value(previous.items) : value; return { items, total: items.length }; }),
  };
};

export default useRealtimeNotifications;
