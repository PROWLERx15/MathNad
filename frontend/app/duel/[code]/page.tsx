'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePrivyWallet } from '@/hooks/usePrivyWallet';
import { useGameSocket } from '@/lib/wsClient';
import { createPublicClient, http } from 'viem';
import { monadTestnet } from '@/config/privy';
import { CONTRACT_ADDRESS, MATHNAD_ABI } from '@/lib/contract';
import { sfx } from '@/lib/sounds';

type LobbyState = 'waiting' | 'opponent_joined' | 'seeding' | 'ready';

const RPC_URL = process.env.NEXT_PUBLIC_MONAD_RPC || 'https://testnet-rpc.monad.xyz';

export default function DuelLobbyPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const { address } = usePrivyWallet();
  const { lastMessage, send, connected } = useGameSocket();

  const [lobbyState, setLobbyState] = useState<LobbyState>('waiting');
  const [duelId, setDuelId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const joinedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const client = useRef(
    createPublicClient({
      chain: monadTestnet,
      transport: http(RPC_URL),
    })
  );

  // Poll for on-chain duel ID (handles case where createDuel tx hasn't confirmed yet)
  useEffect(() => {
    let cancelled = false;

    async function pollForDuelId() {
      try {
        const id = (await client.current.readContract({
          address: CONTRACT_ADDRESS,
          abi: MATHNAD_ABI,
          functionName: 'codeToId',
          args: [code],
        })) as bigint;

        if (id > 0n && !cancelled) {
          setDuelId(id.toString());
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch (err) {
        console.error('Failed to fetch duel:', err);
      }
    }

    // Try immediately, then poll every 3s if not found
    pollForDuelId();
    pollRef.current = setInterval(pollForDuelId, 3000);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [code]);

  // Join WS lobby once we have duelId, address, and connection
  useEffect(() => {
    if (connected && duelId && address && !joinedRef.current) {
      joinedRef.current = true;
      send({
        type: 'JOIN_LOBBY',
        duelId,
        playerAddress: address,
      });
    }
  }, [connected, duelId, address, send]);

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'OPPONENT_JOINED':
        sfx.opponentJoined();
        setLobbyState('seeding');
        break;
      case 'WAITING_SEED':
        setLobbyState('seeding');
        break;
      case 'SEED_READY':
        sfx.opponentJoined();
        setLobbyState('ready');
        break;
      case 'GAME_START':
        if (duelId) {
          router.push(`/battle/${duelId}`);
        }
        break;
    }
  }, [lastMessage, duelId, router]);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-md text-center">
        <h1 className="mb-8 text-2xl font-bold text-white">Battle Lobby</h1>

        <div className="mb-8">
          <p className="mb-3 text-sm text-gray-400">Share this code</p>
          <div
            onClick={copyCode}
            className="pulse-glow inline-block cursor-pointer rounded-2xl border border-accent/30 bg-surface px-8 py-6"
          >
            <p className="font-mono text-5xl font-black tracking-[0.3em] text-accent">
              {code}
            </p>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {copied ? 'Copied!' : 'Click to copy'}
          </p>
        </div>

        <div className="rounded-xl border border-gray-800 bg-surface p-6">
          {lobbyState === 'waiting' && (
            <div>
              <div className="mb-3 flex justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              </div>
              <p className="text-gray-300">
                {duelId ? 'Waiting for opponent...' : 'Confirming on-chain...'}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {duelId
                  ? 'Share the code above to invite someone'
                  : 'Waiting for transaction to confirm'}
              </p>
            </div>
          )}

          {lobbyState === 'seeding' && (
            <div>
              <p className="mb-2 text-lg text-green-400">
                Opponent found! &#9989;
              </p>
              <div className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <p className="text-gray-300">
                  Generating seed... &#127922;
                </p>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Pyth Entropy callback in progress
              </p>
            </div>
          )}

          {lobbyState === 'ready' && (
            <div>
              <p className="mb-2 text-lg text-green-400">
                Seed ready! &#9989;
              </p>
              <div className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <p className="text-gray-300">Starting game...</p>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => router.push('/')}
          className="mt-8 text-sm text-gray-500 hover:text-gray-300"
        >
          &larr; Back to Home
        </button>
      </div>
    </div>
  );
}
