'use client';

interface ResultCardProps {
  isWinner: boolean;
  myScore: number;
  opponentScore: number;
  totalQuestions: number;
  payout?: string;
  txHash?: string;
  onGoHome: () => void;
}

export default function ResultCard({
  isWinner,
  myScore,
  opponentScore,
  totalQuestions,
  payout,
  txHash,
  onGoHome,
}: ResultCardProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-8">
      <div className="w-full max-w-sm rounded-2xl border border-accent/30 bg-surface p-6 text-center shadow-2xl">
        {/* Result Icon */}
        <div className="mb-3 text-6xl">{isWinner ? '🏆' : '💀'}</div>

        {/* Title */}
        <h1
          className={`mb-2 text-2xl font-black ${isWinner ? 'text-accent' : 'text-red-400'}`}
        >
          {isWinner ? 'Victory!' : 'Defeat'}
        </h1>

        {/* Scores */}
        <div className="mb-5 flex items-center justify-center gap-3 text-base">
          <span className="text-white">
            You: {myScore}/{totalQuestions}
          </span>
          <span className="text-gray-600">vs</span>
          <span className="text-gray-400">
            Opp: {opponentScore}/{totalQuestions}
          </span>
        </div>

        {/* Payout */}
        {payout && (
          <div className="mb-4 rounded-xl bg-accent/10 px-4 py-3">
            <p className="text-xs text-gray-400">Payout</p>
            <p className="text-xl font-bold text-accent">{payout} USDC</p>
          </div>
        )}

        {/* TX Link */}
        {txHash && (
          <a
            href={`https://testnet.monadexplorer.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-5 inline-block text-xs text-accent underline transition-colors"
          >
            Verify on Monad Explorer →
          </a>
        )}

        {/* Actions */}
        <div className="mt-5">
          <button
            onClick={onGoHome}
            className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-white transition-all active:scale-95"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
