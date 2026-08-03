/** Mulberry32 — deterministic PRNG for fair online sync */
export const nextRng = (state: number): { value: number; state: number } => {
  let t = (state + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: t >>> 0 };
};

export const shuffleInPlace = <T>(items: T[], rngState: number): number => {
  let state = rngState;
  for (let i = items.length - 1; i > 0; i -= 1) {
    const roll = nextRng(state);
    state = roll.state;
    const j = Math.floor(roll.value * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return state;
};
