import { useEffect, useRef } from 'react';
import { getAuthToken } from './auth';

type WsEvent = Record<string, unknown> & { type: string };
type WsCallback = (event: WsEvent) => void;

// Global singleton WebSocket — one connection for the whole app
let globalWs: WebSocket | null = null;
const listeners = new Set<WsCallback>();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let currentToken: string | null = null;

function createWs(token: string) {
  if (globalWs && globalWs.readyState < 2) return; // Already connecting/open
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  currentToken = token;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;
  const ws = new WebSocket(wsUrl);
  globalWs = ws;

  ws.onmessage = (event) => {
    try {
      const data: WsEvent = JSON.parse(event.data);
      listeners.forEach((cb) => cb(data));
    } catch {}
  };

  ws.onclose = () => {
    globalWs = null;
    // Auto-reconnect after 3s if we still have a token
    reconnectTimer = setTimeout(() => {
      const tok = getAuthToken();
      if (tok) createWs(tok);
    }, 3000);
  };

  ws.onerror = () => {
    ws.close();
  };
}

export function initWebSocket() {
  const token = getAuthToken();
  if (token) createWs(token);
}

export function destroyWebSocket() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  globalWs?.close();
  globalWs = null;
  currentToken = null;
}

export function sendWsMessage(data: object) {
  if (globalWs?.readyState === WebSocket.OPEN) {
    globalWs.send(JSON.stringify(data));
  }
}

export function useWebSocket(onMessage?: WsCallback) {
  const callbackRef = useRef<WsCallback | undefined>(onMessage);
  callbackRef.current = onMessage;

  useEffect(() => {
    if (!onMessage) return;
    const cb: WsCallback = (event) => callbackRef.current?.(event);
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, []);

  // Ensure WS is connected
  useEffect(() => {
    const token = getAuthToken();
    if (token && (!globalWs || globalWs.readyState > 1)) {
      createWs(token);
    }
  }, []);
}
