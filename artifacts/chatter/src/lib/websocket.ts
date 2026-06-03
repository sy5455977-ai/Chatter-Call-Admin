import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetConversationsQueryKey } from '@workspace/api-client-react/generated/api';
import { getAuthToken } from './auth';

type WsEvent = Record<string, unknown> & { type: string };
type WsCallback = (event: WsEvent) => void;

export function useWebSocket(onMessage?: WsCallback) {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const callbackRef = useRef<WsCallback | undefined>(onMessage);
  callbackRef.current = onMessage;

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data: WsEvent = JSON.parse(event.data);

        if (callbackRef.current) {
          callbackRef.current(data);
        }

        if (data.type === 'new_message') {
          queryClient.invalidateQueries({ queryKey: getGetConversationsQueryKey() });
          queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {};

    return () => {
      ws.close();
    };
  }, [queryClient]);

  return wsRef.current;
}
