const audioCache = new Map<string, HTMLAudioElement>();

function getAudio(src: string): HTMLAudioElement {
  let audio = audioCache.get(src);
  if (!audio) {
    audio = new Audio(src);
    audioCache.set(src, audio);
  }
  return audio;
}

export function playSound(name: string, volume = 0.5) {
  if (typeof window === 'undefined') return;
  try {
    const audio = getAudio(`/sounds/${name}`);
    audio.volume = Math.min(1, Math.max(0, volume));
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {
    // Silently ignore audio errors
  }
}

// Pre-mapped sound effects
export const sfx = {
  correctAnswer: () => playSound('coin.wav', 0.6),
  wrongAnswer: () => playSound('incorrect_sfx.wav', 0.5),
  keyPress: () => playSound('donk.wav', 0.15),
  countdownTick: () => playSound('donk2.wav', 0.4),
  gameStart: () => playSound('WHOOSH.WAV', 0.5),
  opponentJoined: () => playSound('chime1.wav', 0.5),
  winner: () => playSound('victory_confetti.wav', 0.7),
  loser: () => playSound('oh_no.wav', 0.6),
  battleCreated: () => playSound('cash_register_sfx.wav', 0.4),
  gameComplete: () => playSound('complete.wav', 0.5),
  backspace: () => playSound('click_error.wav', 0.2),
};
