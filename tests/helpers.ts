import { BattleAI } from '../src/core/BattleAI.ts';
import { BattleEngine } from '../src/core/BattleEngine.ts';
import { SeededRandom, SequenceRandom, type RandomSource } from '../src/core/random.ts';
import { createCharacter } from '../src/core/roster.ts';
import type { CharacterId, Difficulty, ItemId, Side } from '../src/core/types.ts';
import type { KeyValueStorage } from '../src/progression/SaveManager.ts';

/** 0.5 em todas as rolagens: sem esquiva, sem crítico e sem variação de dano. */
export function neutralRandom(): RandomSource {
  return new SequenceRandom([0.5]);
}

export function createBattle(
  player: CharacterId,
  enemy: CharacterId,
  options: { random?: RandomSource; loadout?: Partial<Record<ItemId, number>>; levels?: [number, number] } = {},
): BattleEngine {
  const [playerLevel, enemyLevel] = options.levels ?? [1, 1];
  const engine = new BattleEngine({
    player: createCharacter(player, playerLevel),
    enemy: createCharacter(enemy, enemyLevel),
    random: options.random ?? neutralRandom(),
    loadout: options.loadout,
  });
  engine.start();
  return engine;
}

/** Executa uma ação e falha o teste se ela for recusada. */
export function act(engine: BattleEngine, side: Side, action: Parameters<BattleEngine['perform']>[1]) {
  const result = engine.perform(side, action);
  if (!result.accepted) throw new Error(`Ação recusada: ${result.reason}`);
  return result.events;
}

export function simulate(
  player: CharacterId,
  enemy: CharacterId,
  seed: number,
  difficulties: [Difficulty, Difficulty],
): { winner: Side | null; turns: number } {
  const engine = new BattleEngine({
    player: createCharacter(player),
    enemy: createCharacter(enemy),
    random: new SeededRandom(seed),
  });
  const ais = {
    player: new BattleAI(difficulties[0], new SeededRandom(seed * 7 + 1)),
    enemy: new BattleAI(difficulties[1], new SeededRandom(seed * 13 + 5)),
  };
  engine.start();
  let guard = 0;
  while (!engine.isOver && guard < 400) {
    const side = engine.active;
    const result = engine.perform(side, ais[side].chooseAction(engine, side));
    if (!result.accepted) throw new Error(`IA escolheu ação inválida: ${result.reason}`);
    guard += 1;
  }
  return { winner: engine.winner, turns: engine.turn };
}

/**
 * Fórmula de dano direto do documento, escrita de forma independente do motor:
 * round(ataque × poder × 100 / (100 + defesa) × modificadores).
 */
export function formulaDamage(attack: number, defense: number, power: number, modifier = 1): number {
  return Math.max(1, Math.round(((attack * power * 100) / (100 + defense)) * modifier));
}

/** Passa o turno do lado ativo defendendo (não causa dano nem consome energia). */
export function pass(engine: BattleEngine, times = 1): void {
  for (let i = 0; i < times; i += 1) act(engine, engine.active, { type: 'defend' });
}

export class MemoryStorage implements KeyValueStorage {
  readonly data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}
