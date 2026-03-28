'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePrivyWallet } from '@/hooks/usePrivyWallet';
import { useGameSocket } from '@/lib/wsClient';
import { generateQuestions, type Question } from '@/lib/questions';
import Countdown from '@/components/Countdown';
import QuestionCard from '@/components/QuestionCard';
import TimerBar from '@/components/TimerBar';
import { sfx } from '@/lib/sounds';

type GamePhase = 'countdown' | 'playing' | 'submitting' | 'waiting';

export default function BattlePage() {
  const params = useParams();
  const router = useRouter();
  const duelId = params.duelId as string;
  const { address } = usePrivyWallet();
  const { lastMessage, send, connected } = useGameSocket();

  const [phase, setPhase] = useState<GamePhase>('countdown');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [duration, setDuration] = useState(30);
  const [elapsed, setElapsed] = useState(0);

  // Use refs for values needed in callbacks to avoid stale closures
  const answersRef = useRef<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const submittedRef = useRef(false);
  const joinedRef = useRef(false);
  const phaseRef = useRef<GamePhase>('countdown');

  // Keep phaseRef in sync
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Join lobby on mount
  useEffect(() => {
    if (connected && address && !joinedRef.current) {
      joinedRef.current = true;
      send({
        type: 'JOIN_LOBBY',
        duelId,
        playerAddress: address,
      });
    }
  }, [connected, address, duelId, send]);

  // Handle WS messages
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'GAME_START': {
        const qs = generateQuestions(BigInt(lastMessage.seed), 10);
        setQuestions(qs);
        setDuration(lastMessage.duration);
        // Don't change phase here — Countdown component will call handleCountdownComplete
        break;
      }
      case 'GAME_END':
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(
            `result_${duelId}`,
            JSON.stringify(lastMessage)
          );
        }
        router.push(`/result/${duelId}`);
        break;
    }
  }, [lastMessage, duelId, router]);

  const submitAnswers = useCallback(() => {
    // Prevent double submission
    if (submittedRef.current) return;
    submittedRef.current = true;

    sfx.gameComplete();
    setPhase('waiting');
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const totalTime = Date.now() - startTimeRef.current;
    const finalAnswers = [...answersRef.current];

    console.log('[Battle] Submitting answers:', finalAnswers, 'totalTime:', totalTime);

    send({
      type: 'PLAYER_DONE',
      duelId,
      playerAddress: address || '',
      answers: finalAnswers,
      totalTime,
    });
  }, [duelId, address, send]);

  // Game timer
  useEffect(() => {
    if (phase !== 'playing') return;

    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const e = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsed(e);

      if (e >= duration && !submittedRef.current) {
        submitAnswers();
      }
    }, 250);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [phase, duration, submitAnswers]);

  const handleAnswer = useCallback(
    (answer: number) => {
      if (submittedRef.current) return;

      answersRef.current = [...answersRef.current, answer];

      const nextQ = answersRef.current.length;
      if (nextQ >= questions.length) {
        // All questions answered — submit immediately
        submitAnswers();
      } else {
        setCurrentQ(nextQ);
      }
    },
    [questions.length, submitAnswers]
  );

  const handleCountdownComplete = useCallback(() => {
    setPhase('playing');
  }, []);

  // Waiting for game data
  if (questions.length === 0 && phase === 'countdown') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="mt-4 text-gray-400">Waiting for game to start...</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col bg-background overflow-hidden select-none">
      {/* Countdown Overlay */}
      {phase === 'countdown' && questions.length > 0 && (
        <Countdown onComplete={handleCountdownComplete} />
      )}

      {/* Timer Bar */}
      {phase === 'playing' && (
        <TimerBar duration={duration} elapsed={elapsed} />
      )}

      {/* Game Content */}
      {phase === 'playing' && questions[currentQ] && (
        <QuestionCard
          question={questions[currentQ].question}
          answer={questions[currentQ].answer}
          questionIndex={currentQ}
          totalQuestions={questions.length}
          onAnswer={handleAnswer}
        />
      )}

      {/* Waiting State */}
      {phase === 'waiting' && (
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 mx-auto animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-xl text-gray-300">Calculating results...</p>
            <p className="mt-2 text-sm text-gray-500">
              Waiting for opponent to finish
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
