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
    <section className="bg-[#151025] border-t border-[#7058ff]/20 p-4 pb-8">
      <div className="grid grid-cols-3 gap-3">
        {numberKeys.map((num) => (
          <button
            key={num}
            disabled={disabled}
            onClick={() => onDigit(num)}
            className="h-16 bg-[#1c162d] active:scale-95 transition-all flex items-center justify-center rounded-lg border border-[#4b455b]/10 hover:bg-[#2f2745] group disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="text-2xl font-mono font-bold text-[#ebe1fd] group-hover:text-accent">
              {num}
            </span>
          </button>
        ))}

        {/* Bottom row: Backspace, 0, Submit */}
        <button
          disabled={disabled}
          onClick={onBackspace}
          className="h-16 bg-[#151025] flex items-center justify-center rounded-lg border border-red-500/20 active:scale-95 transition-all text-red-400 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="text-xl font-bold">&#x232B;</span>
        </button>

        <button
          disabled={disabled}
          onClick={() => onDigit(0)}
          className="h-16 bg-[#1c162d] active:scale-95 transition-all flex items-center justify-center rounded-lg border border-[#4b455b]/10 hover:bg-[#2f2745] group disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="text-2xl font-mono font-bold text-[#ebe1fd] group-hover:text-accent">
            0
          </span>
        </button>

        <button
          disabled={disabled}
          onClick={onSubmit}
          className="h-16 bg-[#fead44] flex items-center justify-center rounded-lg active:scale-95 transition-all text-black font-bold shadow-lg shadow-[#fead44]/20 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="text-xl">&#x21B5;</span>
        </button>
      </div>
    </section>
  );
}
