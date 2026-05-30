import { useEffect, useRef, useState, useCallback } from 'react';
import { createLogger } from '../logger';

const logger = createLogger('WS');

export type ConnectionState = 'CONNECTING' | 'OPEN' | 'RECONNECTING' | 'CLOSED';

interface UseWebSocketOptions {
  url: string;
  onMessage: (data: any) => void;
  reconnect?: boolean;
  maxRetries?: number;
}

export function useWebSocket({
  url,
  onMessage,
  reconnect = true,
  maxRetries = Infinity,
}: UseWebSocketOptions) {
  const [state, setState] = useState<ConnectionState>('CONNECTING');
  const wsRef = useRef<WebSocket | null>(null);
  const retryCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);
  const reconnectAllowed = useRef(reconnect);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    setState('CONNECTING');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mounted.current) return;
      logger.info('WebSocket connected');
      setState('OPEN');
      retryCount.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }
        onMessage(data);
      } catch (err: any) {
        logger.error('Failed to parse WebSocket message', { error: err.message, raw: event.data });
      }
    };

    ws.onclose = (event) => {
      if (!mounted.current) return;
      logger.warn(`WebSocket closed: code=${event.code} reason=${event.reason}`);
      if (reconnectAllowed.current && retryCount.current < maxRetries) {
        setState('RECONNECTING');
        const delay = Math.min(1000 * 2 ** retryCount.current, 30000) * (0.7 + Math.random() * 0.6);
        logger.info(`Reconnecting in ${Math.round(delay)}ms (attempt ${retryCount.current + 1})`);
        timerRef.current = setTimeout(() => {
          retryCount.current += 1;
          connect();
        }, delay);
      } else {
        setState('CLOSED');
      }
    };

    ws.onerror = (err) => {
      logger.error('WebSocket error', err);
    };
  }, [url, onMessage, maxRetries]);

  const disconnect = useCallback(() => {
    reconnectAllowed.current = false;
    clearTimer();
    wsRef.current?.close();
  }, []);

  useEffect(() => {
    mounted.current = true;
    connect();
    return () => {
      mounted.current = false;
      clearTimer();
      wsRef.current?.close();
    };
  }, [connect]);

  useEffect(() => {
    const handleOnline = () => {
      logger.info('Network back online');
      if (state !== 'OPEN' && state !== 'CONNECTING') {
        connect();
      }
    };
    const handleOffline = () => {
      logger.warn('Network offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [state, connect]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && wsRef.current?.readyState !== WebSocket.OPEN) {
        logger.info('Tab visible, reconnecting');
        connect();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [connect]);

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      logger.warn('Cannot send – socket not open', data);
    }
  }, []);

  return { state, send, retryCount: retryCount.current };
}
