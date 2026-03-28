'use client';

interface ResultCardProps {
  isWinner: boolean;
  myScore: number;
  opponentScore: number;
  totalQuestions: number;
  payout?: string;
  txHash?: string;
  onRematch: () => void;
  onGoHome: () => void;
}

export default function ResultCard({
  isWinner,
  myScore,
  opponentScore,
  totalQuestions,
  payout,
  txHash,
  onRematch,
  onGoHome,
}: ResultCardProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-accent/30 bg-surface p-8 text-center shadow-2xl">
        {/* Result Icon */}
        <div className="mb-4 text-7xl">{isWinner ? '🏆' : '💀'}</div>

        {/* Title */}
        <h1
          className={`mb-2 text-3xl font-black ${isWinner ? 'text-accent' : 'text-red-400'}`}
        >
          {isWinner ? 'Victory!' : 'Defeat'}
        </h1>

        {/* Scores */}
        <div className="mb-6 flex items-center justify-center gap-4 text-lg">
          <span className="text-white">
            You: {myScore}/{totalQuestions}
          </span>
          <span className="text-gray-600">vs</span>
          <span className="text-gray-400">
            Opponent: {opponentScore}/{totalQuestions}
          </span>
        </div>

        {/* Payout */}
        {payout && (
          <div className="mb-4 rounded-lg bg-accent/10 px-4 py-3">
            <p className="text-sm text-gray-400">Payout</p>
            <p className="text-2xl font-bold text-accent">{payout} USDC</p>
          </div>
        )}

        {/* TX Link */}
        {txHash && (
          <a
            href={`https://testnet.monadexplorer.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-6 inline-block text-sm text-accent underline transition-colors hover:text-accent-light"
          >
            Verify on Monad Explorer &rarr;
          </a>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onGoHome}
            className="flex-1 rounded-lg border border-gray-700 py-3 text-sm text-gray-400 transition-colors hover:border-gray-500"
          >
            Go Home
          </button>
          <button
            onClick={onRematch}
            className="flex-1 rounded-lg bg-accent py-3 text-sm font-bold text-white transition-all hover:bg-accent/80"
          >
            Rematch
          </button>
        </div>
      </div>
    </div>
  );
}
