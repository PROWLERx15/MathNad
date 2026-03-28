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

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 2s
      setTimeout(connect, 2000);
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
    }
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return { lastMessage, send, connected, disconnect };
}
