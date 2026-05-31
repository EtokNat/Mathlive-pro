import { useEffect, useRef, useState, useCallback } from 'react';
import { createLogger } from '../logger';

const logger = createLogger('WS');

export type ConnectionState = 'CONNECTING' | 'OPEN' | 'RECONNECTING' | 'CLOSED';

interface UseWebSocketOptions {
  url: string;
  onMessage: (data: any) => void;
  onAudioData?: (data: ArrayBuffer) => void;
  reconnect?: boolean;
  maxRetries?: number;
}

export function useWebSocket({
  url,
  onMessage,
  onAudioData,
  reconnect = true,
  maxRetries = Infinity,
}: UseWebSocketOptions) {
  const [state, setState] = useState<ConnectionState>('CONNECTING');
  const wsRef = useRef<WebSocket | null>(null);
  const retryCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);
  const reconnectAllowed = useRef(reconnect);
  const onMessageRef = useRef(onMessage);
  const onAudioDataRef = useRef(onAudioData);
  const pendingMessages = useRef<any[]>([]);

  onMessageRef.current = onMessage;
  onAudioDataRef.current = onAudioData;

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
    ws.binaryType = 'arraybuffer'; // Ask the browser for ArrayBuffers
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mounted.current) return;
      logger.info('WebSocket connected');
      setState('OPEN');
      retryCount.current = 0;
      while (pendingMessages.current.length > 0) {
        const msg = pendingMessages.current.shift();
        ws.send(JSON.stringify(msg));
      }
    };

    ws.onmessage = async (event) => {
      // AGGRESSIVE LOGGING: Check exact payload characteristics
      console.log(`[WS onmessage] Payload arrived. typeof: ${typeof event.data}, constructor: ${event.data?.constructor?.name}`);

      // SAFETY NET: If the browser handed us a Blob instead of an ArrayBuffer
      if (event.data instanceof Blob) {
        console.log(`[WS onmessage] ⚠️ Blob detected! Converting to ArrayBuffer...`);
        const buffer = await event.data.arrayBuffer();
        onAudioDataRef.current?.(buffer);
        return;
      }

      // STANDARD ROUTE: We got the ArrayBuffer as requested
      if (event.data instanceof ArrayBuffer) {
        console.log(`[WS onmessage] ✅ ArrayBuffer detected! Size: ${event.data.byteLength} bytes.`);
        onAudioDataRef.current?.(event.data);
        return;
      }
      
      // JSON ROUTE
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }
        onMessageRef.current(data);
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
  }, [url, maxRetries]);

  const connectRef = useRef(connect);
  connectRef.current = connect;

  const disconnect = useCallback(() => {
    reconnectAllowed.current = false;
    clearTimer();
    wsRef.current?.close();
  }, []);

  useEffect(() => {
    mounted.current = true;
    connectRef.current();

    return () => {
      mounted.current = false;
      clearTimer();
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      logger.info('Network back online');
      if (state !== 'OPEN' && state !== 'CONNECTING') {
        connectRef.current();
      }
    };
    const handleOffline = () => logger.warn('Network offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [state]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && wsRef.current?.readyState !== WebSocket.OPEN) {
        logger.info('Tab visible, reconnecting');
        connectRef.current();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      pendingMessages.current.push(data);
      logger.debug('Message queued, socket connecting', data);
    } else {
      logger.warn('Cannot send – socket not open', data);
    }
  }, []);

  const sendBinary = useCallback((buffer: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(buffer);
    } else {
      logger.warn('Cannot send binary – socket not open');
    }
  }, []);

  return { state, send, sendBinary, retryCount: retryCount.current };
}
