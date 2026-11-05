/** Fonte de números aleatórios no intervalo [0, 1). Permite testes determinísticos. */
export interface RandomSource {
  next(): number;
}

export class MathRandom implements RandomSource {
  next(): number {
    return Math.random();
  }
}

/** Gerador mulberry32: rápido, com semente e reprodutível. */
export class SeededRandom implements RandomSource {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/** Devolve os valores informados em sequência (repetindo o último). Útil em testes. */
export class SequenceRandom implements RandomSource {
  private index = 0;
  private readonly values: number[];

  constructor(values: number[]) {
    if (values.length === 0) throw new Error('SequenceRandom precisa de pelo menos um valor.');
    this.values = values;
  }

  next(): number {
    const value = this.values[Math.min(this.index, this.values.length - 1)];
    this.index += 1;
    return value;
  }
}

export function pickRandom<T>(items: readonly T[], random: RandomSource): T {
  if (items.length === 0) throw new Error('Lista vazia.');
  return items[Math.floor(random.next() * items.length)];
}

export function shuffle<T>(items: readonly T[], random: RandomSource): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random.next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
