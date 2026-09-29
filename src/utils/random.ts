/** Deterministic PRNG so generated mock data is stable across reloads. */
export function hashString(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h >>> 0) || 1;
}

export function seeded(seed: string) {
  let a = hashString(seed);
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)],
    pickMany: <T>(list: readonly T[], count: number): T[] => {
      const pool = [...list];
      const out: T[] = [];
      while (pool.length && out.length < count) {
        out.push(pool.splice(Math.floor(next() * pool.length), 1)[0]);
      }
      return out;
    },
    rating: (min = 4.1) => Math.round((min + next() * (5 - min)) * 10) / 10,
    roundTo: (value: number, step: number) => Math.round(value / step) * step,
  };
}
