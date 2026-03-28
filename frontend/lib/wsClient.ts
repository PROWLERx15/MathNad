'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export type WSMessage =
  | { type: 'JOIN_LOBBY'; duelId: string; playerAddress: string }
  | { type: 'OPPONENT_JOINED'; player2: string }
  | { type: 'SEED_READY'; seed: string }
  | { type: 'TICK'; n: number }
  | { type: 'GAME_START'; seed: string; duration: number }
  | {
      type: 'PLAYER_DONE';
      duelId: string;
      playerAddress: string;
      answers: number[];
      totalTime: number;
    }
  | {
      type: 'GAME_END';
      winner: string;
      loser: string;
      winnerScore: number;
      loserScore: number;
      txHash: string;
    }
  | { type: 'ERROR'; message: string }
  | { type: 'WAITING_SEED' };

export function useGameSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [connected, setConnected] = useState(false);
  const mountedRef = useRef(true);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    // Don't reconnect if unmounted
    if (!mountedRef.current) return;

    // Close existing connection before creating new one
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    const url = wsUrl
      ? `${wsUrl}/ws`
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

    console.log('[WS] Connecting to', url);
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('[WS] Connected');
      setConnected(true);
    };
    ws.onclose = () => {
      console.log('[WS] Disconnected');
      setConnected(false);
      // Reconnect after 2s only if still mounted
      if (mountedRef.current) {
        reconnectTimer.current = setTimeout(connect, 2000);
      }
    };
    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        setLastMessage(msg);
      } catch {
        // ignore parse errors
      }
    };

    wsRef.current = ws;
  }, []);

  const send = useCallback((msg: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      console.warn('[WS] Cannot send, not connected');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { lastMessage, send, connected, disconnect };
}
