'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivyWallet } from '@/hooks/usePrivyWallet';
import { useMathNadContract } from '@/hooks/useMathNadContract';
import StakeModal from '@/components/StakeModal';

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('');
}

export default function Home() {
  const router = useRouter();
  const { isConnected, login, address, logout, user, ready } =
    usePrivyWallet();
  const { createDuel, joinDuel, isLoading } = useMathNadContract();

  const [showStakeModal, setShowStakeModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (stake: number, duration: number) => {
    try {
      setError('');
      const code = generateJoinCode();
      const { duelId } = await createDuel(BigInt(stake), duration, code);

      // Save to DB
      await fetch('/api/create-duel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stakeAmount: stake.toString(),
          duration,
          joinCode: code,
          playerAddress: address,
        }),
      });

      setShowStakeModal(false);
      router.push(`/duel/${code}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create duel');
    }
  };

  const handleJoin = async () => {
    if (!joinCode || joinCode.length < 4) return;
    try {
      setError('');
      setJoining(true);

      // Call API first to get duelId and entropy fee
      const apiRes = await fetch('/api/join-duel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          joinCode: joinCode.toUpperCase(),
          playerAddress: address,
        }),
      });
      const apiData = await apiRes.json();
      if (!apiRes.ok) throw new Error(apiData.error || 'Failed to join');

      // On-chain join
      await joinDuel(joinCode.toUpperCase());

      router.push(`/duel/${joinCode.toUpperCase()}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to join duel');
    } finally {
      setJoining(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="mb-2 text-5xl font-black tracking-tight text-white md:text-7xl">
          Math<span className="text-accent">Nad</span>
        </h1>
        <p className="text-lg text-gray-400">
          PvP Math Battles on Monad
        </p>
      </div>

      {!isConnected ? (
        <button
          onClick={login}
          className="rounded-xl bg-accent px-8 py-4 text-lg font-bold text-white shadow-lg shadow-accent/30 transition-all hover:bg-accent/80 hover:shadow-accent/50"
        >
          Sign in with Google
        </button>
      ) : (
        <div className="w-full max-w-md space-y-6">
          {/* Wallet Info */}
          <div className="flex items-center justify-between rounded-xl border border-gray-800 bg-surface px-4 py-3">
            <div className="text-sm">
              <p className="text-gray-400">
                {user?.google?.email || 'Connected'}
              </p>
              <p className="font-mono text-xs text-gray-600">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
            </div>
            <button
              onClick={logout}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Logout
            </button>
          </div>

          {/* Create Battle */}
          <button
            onClick={() => setShowStakeModal(true)}
            className="pulse-glow w-full rounded-2xl border border-accent/30 bg-surface p-6 text-left transition-all hover:border-accent/60"
          >
            <div className="mb-2 text-3xl">&#9876;&#65039;</div>
            <h2 className="mb-1 text-xl font-bold text-white">
              Create Battle
            </h2>
            <p className="text-sm text-gray-400">
              Set your stakes and challenge an opponent
            </p>
          </button>

          {/* Join Battle */}
          <div className="rounded-2xl border border-gray-800 bg-surface p-6">
            <div className="mb-2 text-3xl">&#128279;</div>
            <h2 className="mb-3 text-xl font-bold text-white">Join Battle</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) =>
                  setJoinCode(e.target.value.toUpperCase().slice(0, 6))
                }
                placeholder="Enter 6-char code"
                maxLength={6}
                className="flex-1 rounded-lg border border-gray-700 bg-surface-light px-4 py-3 font-mono text-center text-lg tracking-widest text-white outline-none transition-all focus:border-accent"
              />
              <button
                onClick={handleJoin}
                disabled={joining || joinCode.length < 4}
                className="rounded-lg bg-accent px-6 py-3 font-bold text-white transition-all hover:bg-accent/80 disabled:opacity-50"
              >
                {joining ? '...' : 'Join'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-16 text-center text-xs text-gray-600">
        Powered by Monad &middot; Pyth Entropy VRF &middot; USDC Stakes
      </div>

      {/* Stake Modal */}
      <StakeModal
        open={showStakeModal}
        onClose={() => setShowStakeModal(false)}
        onConfirm={handleCreate}
        loading={isLoading}
      />
    </div>
  );
}
