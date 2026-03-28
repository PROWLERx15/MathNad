'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, type Variants } from 'framer-motion';
import Keypad from './Keypad';
import { sfx } from '@/lib/sounds';

interface QuestionCardProps {
  question: string;
  answer: number;
  questionIndex: number;
  totalQuestions: number;
  onAnswer: (answer: number) => void;
}

const shakeVariants: Variants = {
  idle: { x: 0 },
  shake: {
    x: [0, -12, 12, -8, 8, -4, 4, 0],
    transition: { duration: 0.4, ease: 'easeInOut' },
  },
};

function parseQuestion(q: string): {
  operandA: string;
  operator: string;
  operandB: string;
} {
  // Question format: "12 + 5", "15 − 8", "7 × 9", "24 ÷ 3"
  const parts = q.split(' ');
  return {
    operandA: parts[0],
    operator: parts[1],
    operandB: parts[2],
  };
}

export default function QuestionCard({
  question,
  answer,
  questionIndex,
  totalQuestions,
  onAnswer,
}: QuestionCardProps) {
  const [userInput, setUserInput] = useState('');
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>(
    'idle'
  );
  const [shakeKey, setShakeKey] = useState(0);
  const pendingCheck = useRef(false);
  const feedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoCheckTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const answerStr = answer.toString();
  const answerLength = answerStr.length;
  const { operandA, operator, operandB } = parseQuestion(question);

  // Reset state on question change
  useEffect(() => {
    setUserInput('');
    setFeedback('idle');
    pendingCheck.current = false;
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    if (autoCheckTimeout.current) clearTimeout(autoCheckTimeout.current);
  }, [question]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
      if (autoCheckTimeout.current) clearTimeout(autoCheckTimeout.current);
    };
  }, []);

  function scheduleFeedbackReset(ms: number) {
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
    feedbackTimeout.current = setTimeout(() => {
      setFeedback('idle');
    }, ms);
  }

  const handleDigit = useCallback(
    (digit: number) => {
      if (pendingCheck.current) return;

      sfx.keyPress();
      setUserInput((prev) => {
        if (prev.length >= answerLength) return prev;
        return prev + digit.toString();
      });

      if (autoCheckTimeout.current) clearTimeout(autoCheckTimeout.current);

      autoCheckTimeout.current = setTimeout(() => {
        setUserInput((prevInput) => {
          if (prevInput.length !== answerLength) {
            pendingCheck.current = false;
            return prevInput;
          }

          if (prevInput === answerStr) {
            // CORRECT
            pendingCheck.current = true;
            setFeedback('correct');
            sfx.correctAnswer();
            scheduleFeedbackReset(200);

            setTimeout(() => {
              onAnswer(answer);
              pendingCheck.current = false;
            }, 80);
          } else {
            // WRONG
            pendingCheck.current = true;
            setFeedback('wrong');
            sfx.wrongAnswer();
            setShakeKey((k) => k + 1);
            scheduleFeedbackReset(400);

            setTimeout(() => {
              setUserInput('');
              pendingCheck.current = false;
            }, 200);
          }

          return prevInput;
        });
      }, 0);
    },
    [answerLength, answerStr, answer, onAnswer]
  );

  const handleBackspace = useCallback(() => {
    if (pendingCheck.current) return;
    sfx.backspace();
    setUserInput((prev) => prev.slice(0, -1));
  }, []);

  const handleSubmit = useCallback(() => {
    if (pendingCheck.current || userInput === '') return;

    if (userInput === answerStr) {
      pendingCheck.current = true;
      setFeedback('correct');
      sfx.correctAnswer();
      scheduleFeedbackReset(200);

      setTimeout(() => {
        onAnswer(answer);
        pendingCheck.current = false;
      }, 80);
    } else {
      pendingCheck.current = true;
      setFeedback('wrong');
      sfx.wrongAnswer();
      setShakeKey((k) => k + 1);
      scheduleFeedbackReset(400);

      setTimeout(() => {
        setUserInput('');
        pendingCheck.current = false;
      }, 200);
    }
  }, [userInput, answerStr, answer, onAnswer]);

  // Build input cells
  const inputCells = Array.from({ length: answerLength }, (_, i) =>
    userInput[i] || null
  );

  // Feedback styles
  const feedbackStyles =
    feedback === 'correct'
      ? {
          border: 'border-[#85E6FF]',
          glow: 'shadow-[0_0_40px_rgba(133,230,255,0.35)]',
          inputBorder: 'border-[#85E6FF]',
        }
      : feedback === 'wrong'
        ? {
            border: 'border-[#FF8EE4]',
            glow: 'shadow-[0_0_40px_rgba(255,142,228,0.35)]',
            inputBorder: 'border-[#FF8EE4]',
          }
        : {
            border: 'border-transparent',
            glow: '',
            inputBorder: '',
          };

  return (
    <div className="flex flex-col h-full w-full max-w-md mx-auto relative">
      {/* Full-screen feedback flash overlay */}
      {feedback !== 'idle' && (
        <div
          className={`fixed inset-0 pointer-events-none z-[60] transition-opacity duration-100 ${
            feedback === 'correct'
              ? 'bg-[#85E6FF]/[0.08]'
              : 'bg-[#FF8EE4]/[0.08]'
          }`}
        />
      )}

      {/* Progress badge */}
      <div className="flex items-center justify-center pt-4 pb-2">
        <span className="rounded bg-accent/20 px-3 py-1 text-sm text-accent font-bold">
          Q {questionIndex + 1}/{totalQuestions}
        </span>
      </div>

      {/* Arena main canvas */}
      <main className="flex-grow flex flex-col items-center justify-center px-6">
        {/* The Monolith Expression */}
        <div
          className={`text-center border-2 ${feedbackStyles.border} ${feedbackStyles.glow} rounded-xl p-6 transition-all duration-100`}
        >
          <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter leading-none">
            {operandA}{' '}
            <span className="text-accent mx-2">{operator}</span>{' '}
            {operandB}
          </h1>

          {/* Answer Input Cells with shake */}
          <motion.div
            key={shakeKey}
            variants={shakeVariants}
            initial="idle"
            animate={feedback === 'wrong' ? 'shake' : 'idle'}
            className="mt-8 flex justify-center gap-2"
          >
            {inputCells.map((char, i) => {
              const isFilled = char !== null;
              const isActive = i === userInput.length;

              let cellBorder = isFilled
                ? 'border-accent'
                : isActive
                  ? 'border-accent/60'
                  : 'border-[#4b455b]';

              if (isFilled && feedbackStyles.inputBorder) {
                cellBorder = feedbackStyles.inputBorder;
              }

              return (
                <div
                  key={i}
                  className={`w-12 h-16 border-b-4 ${cellBorder} bg-[#1c162d]/50 flex items-center justify-center transition-colors duration-100`}
                >
                  <span className="text-4xl font-mono font-bold text-white">
                    {isFilled ? char : isActive ? '_' : ''}
                  </span>
                </div>
              );
            })}
          </motion.div>
        </div>
      </main>

      {/* Numeric Keypad */}
      <Keypad
        onDigit={handleDigit}
        onBackspace={handleBackspace}
        onSubmit={handleSubmit}
        disabled={false}
      />
    </div>
  );
}
