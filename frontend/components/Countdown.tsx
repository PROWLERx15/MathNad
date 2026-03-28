'use client';

import { useEffect, useState } from 'react';
import { sfx } from '@/lib/sounds';

interface CountdownProps {
  onComplete: () => void;
  startFrom?: number;
}

export default function Countdown({
  onComplete,
  startFrom = 3,
}: CountdownProps) {
  const [count, setCount] = useState(startFrom);

  useEffect(() => {
    if (count <= 0) {
      sfx.gameStart();
      onComplete();
      return;
    }
    sfx.countdownTick();
    const timer = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [count, onComplete]);

  if (count <= 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md">
      <div className="text-center">
        <div
          key={count}
          className="animate-bounce text-9xl font-black text-accent drop-shadow-[0_0_30px_rgba(131,110,249,0.5)]"
        >
          {count}
        </div>
        <p className="mt-4 text-lg text-gray-400">Get ready...</p>
      </div>
    </div>
  );
}
