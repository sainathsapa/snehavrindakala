"use client";

/**
 * useRealtimeNotifications — live admin notifications over SSE.
 *
 * Reconnects with exponential backoff, pauses when the tab is hidden (a phone
 * in a pocket should not hold a stream open), and exposes local read state so
 * the bell responds instantly without waiting for a round-trip.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface AppNotification {
  id: string;
  audience: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

interface State {
  notifications: AppNotification[];
  unread: number;
  connected: boolean;
}

const MAX_BACKOFF_MS = 30_000;

export function useRealtimeNotifications(
  audience = "admin",
  enabled = true
): State & {
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
} {
  const [state, setState] = useState<State>({
    notifications: [],
    unread: 0,
    connected: false,
  });

  const sourceRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const recomputeUnread = useCallback((list: AppNotification[]) => {
    return list.filter((n) => !n.read).length;
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !mountedRef.current) return;
    if (sourceRef.current) sourceRef.current.close();

    const source = new EventSource(
      `/api/notifications?stream=1&audience=${encodeURIComponent(audience)}`
    );
    sourceRef.current = source;

    source.addEventListener("init", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as {
        notifications: AppNotification[];
        unread: number;
      };
      retryRef.current = 0;
      setState({
        notifications: data.notifications,
        unread: data.unread ?? recomputeUnread(data.notifications),
        connected: true,
      });
    });

    source.addEventListener("notification", (event) => {
      const notification = JSON.parse(
        (event as MessageEvent).data
      ) as AppNotification;
      setState((prev) => {
        if (prev.notifications.some((n) => n.id === notification.id)) {
          return prev;
        }
        const notifications = [notification, ...prev.notifications].slice(0, 100);
        return {
          ...prev,
          notifications,
          unread: notification.read ? prev.unread : prev.unread + 1,
        };
      });
    });

    // A server-side failure should not tear down the page; retry quietly.
    source.addEventListener("error", () => {
      setState((prev) => ({ ...prev, connected: false }));
      source.close();
      sourceRef.current = null;

      const delay = Math.min(
        1000 * 2 ** retryRef.current,
        MAX_BACKOFF_MS
      );
      retryRef.current += 1;
      timerRef.current = setTimeout(connect, delay);
    });
  }, [audience, enabled, recomputeUnread]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        retryRef.current = 0;
        connect();
      } else {
        sourceRef.current?.close();
        sourceRef.current = null;
        setState((prev) => ({ ...prev, connected: false }));
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      if (timerRef.current) clearTimeout(timerRef.current);
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [connect]);

  const markRead = useCallback(async (id: string) => {
    setState((prev) => {
      const notifications = prev.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      return {
        ...prev,
        notifications,
        unread: notifications.filter((n) => !n.read).length,
      };
    });

    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      // Optimistic update stands; the next init will correct it.
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
      unread: 0,
    }));

    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true, audience }),
      });
    } catch {
      // Same as above.
    }
  }, [audience]);

  return { ...state, markRead, markAllRead };
}
