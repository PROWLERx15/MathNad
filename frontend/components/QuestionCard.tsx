'use client';

import { useState, useRef, useEffect } from 'react';

interface QuestionCardProps {
  question: string;
  questionIndex: number;
  totalQuestions: number;
  onAnswer: (answer: number) => void;
}

export default function QuestionCard({
  question,
  questionIndex,
  totalQuestions,
  onAnswer,
}: QuestionCardProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue('');
    inputRef.current?.focus();
  }, [question]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      onAnswer(num);
      setValue('');
    }
  };

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Progress */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span className="rounded bg-accent/20 px-2 py-1 text-accent">
          Q {questionIndex + 1}/{totalQuestions}
        </span>
      </div>

      {/* Question */}
      <div className="text-center text-5xl font-black tracking-wider text-white md:text-7xl">
        {question}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex w-full max-w-xs gap-3">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="-?[0-9]*"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="?"
          autoFocus
          className="flex-1 rounded-xl border border-accent/30 bg-surface-light px-6 py-4 text-center text-2xl font-bold text-white outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <button
          type="submit"
          className="rounded-xl bg-accent px-6 py-4 text-lg font-bold text-white transition-all hover:bg-accent/80 active:scale-95"
        >
          Go
        </button>
      </form>
    </div>
  );
}
