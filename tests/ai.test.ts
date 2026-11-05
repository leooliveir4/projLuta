import { describe, expect, it } from 'vitest';
import { BattleAI } from '../src/core/BattleAI.ts';
import { ECLIPSE_ID, type Nyxara } from '../src/core/characters/Nyxara.ts';
import { SeededRandom } from '../src/core/random.ts';
import { CHARACTER_IDS } from '../src/core/roster.ts';
import type { BattleAction, Difficulty } from '../src/core/types.ts';
import { act, createBattle, simulate } from './helpers.ts';

function bestOf(ai: BattleAI, ...args: Parameters<BattleAI['evaluate']>): BattleAction {
  return [...ai.evaluate(...args)].sort((a, b) => b.score - a.score)[0].action;
}

describe('IA dos adversários', () => {
  it('joga com os seis personagens nas três dificuldades sem escolher ações inválidas', () => {
    for (const difficulty of ['easy', 'normal', 'hard'] as Difficulty[]) {
      for (const a of CHARACTER_IDS) {
        for (const b of CHARACTER_IDS) {
          const seed = CHARACTER_IDS.indexOf(a) * 6 + CHARACTER_IDS.indexOf(b) + 1;
          const result = simulate(a, b, seed, [difficulty, difficulty]);
          expect(result.winner).not.toBeNull();
        }
      }
    }
  });

  it('finaliza o adversário quando há um golpe letal garantido', () => {
    const engine = createBattle('lyra', 'dravenor');
    engine.character('enemy').takeDamage(engine.character('enemy').maxHp - 60);
    const action = new BattleAI('hard', new SeededRandom(1)).chooseAction(engine, 'player');
    expect(action.type).toBe('ability');
  });

  it('com pouca vida e ameaçada de morte, defende ou usa poção', () => {
    const engine = createBattle('kael', 'vexra');
    const kael = engine.character('player');
    kael.takeDamage(kael.hp - 60);
    const action = new BattleAI('hard', new SeededRandom(5)).chooseAction(engine, 'player');
    expect(['defend', 'item']).toContain(action.type);
  });

  it('não usa a Ultimate sem influência e a usa quando ela está pronta', () => {
    const engine = createBattle('nyxara', 'vorath');
    const nyx = engine.character('player') as Nyxara;
    const ai = new BattleAI('hard', new SeededRandom(2));
    expect(ai.evaluate(engine, 'player').some((entry) => entry.action.type === 'ability' && entry.action.abilityId === ECLIPSE_ID)).toBe(false);

    while (nyx.influence < 100) {
      act(engine, 'player', { type: 'attack' });
      act(engine, 'enemy', { type: 'defend' });
    }
    expect(bestOf(ai, engine, 'player')).toEqual({ type: 'ability', abilityId: ECLIPSE_ID });
  });

  it('considera o risco de revide do Véu do Massacre', () => {
    const engine = createBattle('nyxara', 'vorath');
    const nyx = engine.character('player') as Nyxara;
    while (nyx.influence < 100) {
      act(engine, 'player', { type: 'attack' });
      act(engine, 'enemy', { type: 'defend' });
    }
    act(engine, 'player', { type: 'ability', abilityId: ECLIPSE_ID });
    act(engine, 'enemy', { type: 'defend' });
    const ai = new BattleAI('hard');
    const before = ai.evaluate(engine, 'player');
    act(engine, 'player', { type: 'ability', abilityId: 'nyx-veil' });
    const after = new BattleAI('hard').evaluate(engine, 'enemy');
    const attack = after.find((entry) => entry.action.type === 'attack')!;
    const normal = new BattleAI('easy').evaluate(engine, 'enemy').find((entry) => entry.action.type === 'attack')!;
    expect(attack.score).toBeLessThan(normal.score);
    expect(before.length).toBeGreaterThan(0);
  });

  it('dificuldades mudam a qualidade das decisões, não os atributos', () => {
    let hardWins = 0;
    let games = 0;
    for (const a of CHARACTER_IDS) {
      for (const b of CHARACTER_IDS) {
        for (let seed = 1; seed <= 6; seed += 1) {
          const result = simulate(a, b, seed, ['hard', 'easy']);
          if (result.winner === 'player') hardWins += 1;
          games += 1;
        }
      }
    }
    expect(hardWins / games).toBeGreaterThan(0.6);
  });

  it('valoriza um bônus de ataque pela duração restante da luta, não só pelo próximo golpe', () => {
    const scoreOf = (engine: ReturnType<typeof createBattle>, id: string) =>
      new BattleAI('hard').evaluate(engine, 'player').find((entry) => entry.action.type === 'ability' && entry.action.abilityId === id)!.score;
    const fresh = createBattle('vexra', 'dravenor');
    const ending = createBattle('vexra', 'dravenor');
    ending.character('enemy').takeDamage(ending.character('enemy').maxHp - 60);
    expect(scoreOf(fresh, 'overload')).toBeGreaterThan(scoreOf(ending, 'overload') + 50);
    expect(bestOf(new BattleAI('hard'), ending, 'player').type).not.toBe('item');
    expect(bestOf(new BattleAI('hard'), ending, 'player')).not.toEqual({ type: 'ability', abilityId: 'overload' });
  });

  it('no fácil a IA não planeja: valoriza menos a preparação do que no difícil', () => {
    const engine = createBattle('kael', 'vorath');
    const duel = (difficulty: Difficulty) =>
      new BattleAI(difficulty).evaluate(engine, 'player').find((entry) => entry.action.type === 'ability' && entry.action.abilityId === 'perfect-duel')!.score;
    expect(duel('easy')).toBeLessThan(duel('hard'));
  });

  it('Barreira Arcana vale mais quando o próximo golpe do adversário pode ser letal', () => {
    const barrier = (hp: number) => {
      const engine = createBattle('lyra', 'kael');
      const lyra = engine.character('player');
      if (engine.active !== 'player') act(engine, 'enemy', { type: 'defend' });
      lyra.takeDamage(lyra.hp - hp);
      return new BattleAI('hard').evaluate(engine, 'player').find((entry) => entry.action.type === 'ability' && entry.action.abilityId === 'arcane-barrier')!.score;
    };
    expect(barrier(120)).toBeGreaterThan(barrier(600) + 100);
  });

  it('usa o Elixir de Energia quando ele libera a habilidade mais forte, e não com energia cheia', () => {
    const low = createBattle('lyra', 'dravenor');
    low.character('player').spendEnergy(80);
    expect(bestOf(new BattleAI('hard'), low, 'player')).toEqual({ type: 'item', itemId: 'energy-elixir' });

    const full = createBattle('lyra', 'dravenor');
    expect(bestOf(new BattleAI('hard'), full, 'player')).not.toEqual({ type: 'item', itemId: 'energy-elixir' });
  });
});
