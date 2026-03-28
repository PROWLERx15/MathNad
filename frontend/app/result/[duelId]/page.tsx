'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePrivyWallet } from '@/hooks/usePrivyWallet';
import ResultCard from '@/components/ResultCard';
import { sfx } from '@/lib/sounds';

interface GameResult {
  winner: string;
  loser: string;
  winnerScore: number;
  loserScore: number;
  txHash: string;
}

export default function ResultPage() {
  const params = useParams();
  const router = useRouter();
  const duelId = params.duelId as string;
  const { address } = usePrivyWallet();

  const [result, setResult] = useState<GameResult | null>(null);
  const soundPlayed = useRef(false);

  useEffect(() => {
    // Try to get result from sessionStorage (set by battle page)
    const stored = sessionStorage.getItem(`result_${duelId}`);
    if (stored) {
      try {
        setResult(JSON.parse(stored));
      } catch {
        // ignore
      }
    }
  }, [duelId]);

  // Play win/lose sound once
  useEffect(() => {
    if (!result || soundPlayed.current) return;
    soundPlayed.current = true;
    const isWin = address?.toLowerCase() === result.winner.toLowerCase();
    if (isWin) {
      sfx.winner();
    } else {
      sfx.loser();
    }
  }, [result, address]);

  if (!result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 mx-auto animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-gray-400">Loading results...</p>
        </div>
      </div>
    );
  }

  const isWinner =
    address?.toLowerCase() === result.winner.toLowerCase();
  const myScore = isWinner ? result.winnerScore : result.loserScore;
  const opponentScore = isWinner ? result.loserScore : result.winnerScore;

  // Calculate payout (95% of 2x stake)
  const payoutDisplay = isWinner ? 'Won' : 'Lost';

  return (
    <ResultCard
      isWinner={isWinner}
      myScore={myScore}
      opponentScore={opponentScore}
      totalQuestions={10}
      payout={isWinner ? payoutDisplay : undefined}
      txHash={result.txHash}
      onGoHome={() => router.push('/')}
    />
  );
}
