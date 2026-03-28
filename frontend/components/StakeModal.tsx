'use client';

import { useState } from 'react';
import { sfx } from '@/lib/sounds';

const STAKE_OPTIONS = [
  { label: '0.1 USDC', value: 100_000 },
  { label: '0.5 USDC', value: 500_000 },
  { label: '1 USDC', value: 1_000_000 },
];

const DURATION_OPTIONS = [
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
];

interface StakeModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (stake: number, duration: number) => void;
  loading?: boolean;
}

export default function StakeModal({
  open,
  onClose,
  onConfirm,
  loading,
}: StakeModalProps) {
  const [selectedStake, setSelectedStake] = useState(STAKE_OPTIONS[0].value);
  const [selectedDuration, setSelectedDuration] = useState(
    DURATION_OPTIONS[0].value
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm rounded-t-3xl border-t border-accent/30 bg-surface p-6 pb-10 shadow-2xl sm:rounded-2xl sm:border sm:pb-6">
        <h2 className="mb-5 text-center text-lg font-bold text-white">
          Battle Settings
        </h2>

        {/* Stake Selection */}
        <div className="mb-5">
          <p className="mb-2 text-xs text-gray-400">Stake Amount</p>
          <div className="grid grid-cols-3 gap-2">
            {STAKE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedStake(opt.value)}
                className={`rounded-xl border px-3 py-3 text-sm font-medium transition-all active:scale-95 ${
                  selectedStake === opt.value
                    ? 'border-accent bg-accent/20 text-accent-light'
                    : 'border-gray-700 bg-surface-light text-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Duration Selection */}
        <div className="mb-6">
          <p className="mb-2 text-xs text-gray-400">Game Duration</p>
          <div className="grid grid-cols-2 gap-2">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedDuration(opt.value)}
                className={`rounded-xl border px-3 py-3 text-sm font-medium transition-all active:scale-95 ${
                  selectedDuration === opt.value
                    ? 'border-accent bg-accent/20 text-accent-light'
                    : 'border-gray-700 bg-surface-light text-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-gray-700 py-3 text-sm text-gray-400 transition-colors active:bg-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              sfx.battleCreated();
              onConfirm(selectedStake, selectedDuration);
            }}
            disabled={loading}
            className="flex-1 rounded-xl bg-accent py-3 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Battle'}
          </button>
        </div>
      </div>
    </div>
  );
}
