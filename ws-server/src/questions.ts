export type Question = { question: string; answer: number };

function seededRand(seed: bigint, index: number): number {
  let h = seed ^ (BigInt(index) * 0x9e3779b97f4a7c15n);
  h = ((h >> 30n) ^ h) * 0xbf58476d1ce4e5b9n;
  h = ((h >> 27n) ^ h) * 0x94d049bb133111ebn;
  h = (h >> 31n) ^ h;
  return Number((h < 0n ? -h : h) % 10000n);
}

export function generateQuestions(seed: bigint, count = 10): Question[] {
  return Array.from({ length: count }, (_, i) => {
    const r = seededRand(seed, i);
    if (i < 4) {
      const a = (r % 20) + 1;
      const b = (r % 15) + 1;
      return r % 2 === 0
        ? { question: `${a} + ${b}`, answer: a + b }
        : {
            question: `${Math.max(a, b)} − ${Math.min(a, b)}`,
            answer: Math.abs(a - b),
          };
    } else if (i < 7) {
      const a = (r % 11) + 2;
      const b = (r % 11) + 2;
      return { question: `${a} × ${b}`, answer: a * b };
    } else {
      const divisor = (r % 10) + 2;
      const ans = (r % 12) + 1;
      return { question: `${divisor * ans} ÷ ${divisor}`, answer: ans };
    }
  });
}
