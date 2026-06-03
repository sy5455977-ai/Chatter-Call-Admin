import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetConversationsQueryKey, getListMessagesQueryKey } from '@workspace/api-client-react/generated/api';
import { getAuthToken } from './auth';

export function useWebSocket() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_message') {
          queryClient.invalidateQueries({ queryKey: getGetConversationsQueryKey() });
          // If we have conversationId in the event, we could invalidate specific ones,
          // but for now we'll just invalidate all list messages to be safe.
          queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
        }
      } catch (e) {
        console.error('Error parsing ws message', e);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return () => {
      ws.close();
    };
  }, [queryClient]);

  return wsRef.current;
}
