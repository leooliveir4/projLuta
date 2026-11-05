import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '../src/core/roster.ts';
import type { CharacterId, Difficulty } from '../src/core/types.ts';
import { simulate } from './helpers.ts';

const BATTLES_PER_PAIR = 100;

interface PairResult {
  a: CharacterId;
  b: CharacterId;
  /** Vitórias do primeiro personagem do par (0 a 1). */
  rate: number;
  turns: number;
}

/** IA contra IA em todos os pares, alternando os lados a cada semente (mesmo método de `npm run simulate`). */
function runAll(difficulty: Difficulty): { rates: Record<CharacterId, number>; pairs: PairResult[] } {
  const wins = Object.fromEntries(CHARACTER_IDS.map((id) => [id, 0])) as Record<CharacterId, number>;
  const games = Object.fromEntries(CHARACTER_IDS.map((id) => [id, 0])) as Record<CharacterId, number>;
  const pairs: PairResult[] = [];
  for (let i = 0; i < CHARACTER_IDS.length; i += 1) {
    for (let j = i + 1; j < CHARACTER_IDS.length; j += 1) {
      const a = CHARACTER_IDS[i];
      const b = CHARACTER_IDS[j];
      let aWins = 0;
      let turns = 0;
      for (let seed = 1; seed <= BATTLES_PER_PAIR; seed += 1) {
        const aIsPlayer = seed % 2 === 1;
        const result = aIsPlayer ? simulate(a, b, seed, [difficulty, difficulty]) : simulate(b, a, seed, [difficulty, difficulty]);
        const aWon = result.winner === (aIsPlayer ? 'player' : 'enemy');
        if (aWon) aWins += 1;
        turns += result.turns;
        wins[aWon ? a : b] += 1;
        games[a] += 1;
        games[b] += 1;
      }
      pairs.push({ a, b, rate: aWins / BATTLES_PER_PAIR, turns: turns / BATTLES_PER_PAIR });
    }
  }
  const rates = Object.fromEntries(CHARACTER_IDS.map((id) => [id, wins[id] / games[id]])) as Record<CharacterId, number>;
  return { rates, pairs };
}

describe('balanceamento (IA contra IA, 100 combates por par)', () => {
  for (const difficulty of ['normal', 'hard'] as Difficulty[]) {
    it(`dificuldade ${difficulty}: agregado entre 35% e 65%, nenhum confronto extremo e lutas sem arrastar`, () => {
      const { rates, pairs } = runAll(difficulty);
      for (const id of CHARACTER_IDS) {
        expect(rates[id], id).toBeGreaterThanOrEqual(0.35);
        expect(rates[id], id).toBeLessThanOrEqual(0.65);
      }
      for (const pair of pairs) {
        const name = `${pair.a} × ${pair.b}`;
        // Confrontos favoráveis existem, mas nenhum par deve ficar praticamente decidido.
        expect(pair.rate, name).toBeGreaterThanOrEqual(0.2);
        expect(pair.rate, name).toBeLessThanOrEqual(0.8);
        // O confronto mais longo (Dravenor × Vorath) chegava a 87 turnos em média antes da revisão.
        expect(pair.turns, name).toBeLessThanOrEqual(75);
      }
    });
  }
});
