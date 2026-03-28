'use client';

interface KeypadProps {
  onDigit: (digit: number) => void;
  onBackspace: () => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export default function Keypad({
  onDigit,
  onBackspace,
  onSubmit,
  disabled = false,
}: KeypadProps) {
  const numberKeys = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  return (
    <section className="bg-[#151025] border-t border-[#7058ff]/20 px-3 pt-3 pb-[max(env(safe-area-inset-bottom,8px),8px)]">
      <div className="grid grid-cols-3 gap-2">
        {numberKeys.map((num) => (
          <button
            key={num}
            disabled={disabled}
            onClick={() => onDigit(num)}
            className="h-14 bg-[#1c162d] active:scale-90 active:bg-[#2f2745] transition-all flex items-center justify-center rounded-xl border border-[#4b455b]/10 disabled:opacity-40 disabled:cursor-not-allowed select-none touch-manipulation"
          >
            <span className="text-2xl font-mono font-bold text-[#ebe1fd]">
              {num}
            </span>
          </button>
        ))}

        {/* Bottom row: Backspace, 0, Submit */}
        <button
          disabled={disabled}
          onClick={onBackspace}
          className="h-14 bg-[#151025] flex items-center justify-center rounded-xl border border-red-500/20 active:scale-90 active:bg-red-500/10 transition-all text-red-400 disabled:opacity-40 disabled:cursor-not-allowed select-none touch-manipulation"
        >
          <span className="text-xl font-bold">⌫</span>
        </button>

        <button
          disabled={disabled}
          onClick={() => onDigit(0)}
          className="h-14 bg-[#1c162d] active:scale-90 active:bg-[#2f2745] transition-all flex items-center justify-center rounded-xl border border-[#4b455b]/10 disabled:opacity-40 disabled:cursor-not-allowed select-none touch-manipulation"
        >
          <span className="text-2xl font-mono font-bold text-[#ebe1fd]">
            0
          </span>
        </button>

        <button
          disabled={disabled}
          onClick={onSubmit}
          className="h-14 bg-[#fead44] flex items-center justify-center rounded-xl active:scale-90 active:bg-[#e09a30] transition-all text-black font-bold shadow-lg shadow-[#fead44]/20 disabled:opacity-40 disabled:cursor-not-allowed select-none touch-manipulation"
        >
          <span className="text-xl">↵</span>
        </button>
      </div>
    </section>
  );
}
