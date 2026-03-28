'use client';

interface TimerBarProps {
  duration: number; // total seconds
  elapsed: number; // seconds elapsed
}

export default function TimerBar({ duration, elapsed }: TimerBarProps) {
  const remaining = Math.max(0, duration - elapsed);
  const pct = (remaining / duration) * 100;

  const color =
    pct > 50
      ? 'bg-accent'
      : pct > 25
        ? 'bg-yellow-500'
        : 'bg-red-500';

  return (
    <div className="fixed left-0 right-0 top-0 z-40 bg-surface" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="h-1.5 bg-surface">
        <div
          className={`h-full timer-glow transition-all duration-1000 ease-linear ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="absolute right-4 top-full mt-1 text-[10px] font-mono text-gray-400">
        {remaining}s
      </div>
    </div>
  );
}
