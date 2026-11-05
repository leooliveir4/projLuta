import type { Character } from './Character.ts';
import { Dravenor } from './characters/Dravenor.ts';
import { Kael } from './characters/Kael.ts';
import { Lyra } from './characters/Lyra.ts';
import { Nyxara } from './characters/Nyxara.ts';
import { Vexra } from './characters/Vexra.ts';
import { Vorath } from './characters/Vorath.ts';
import type { CharacterId } from './types.ts';

export const CHARACTER_IDS: readonly CharacterId[] = ['lyra', 'vexra', 'dravenor', 'kael', 'nyxara', 'vorath'];

const FACTORIES: Record<CharacterId, (level: number, displayName?: string) => Character> = {
  lyra: (level, displayName) => new Lyra(level, displayName),
  vexra: (level, displayName) => new Vexra(level, displayName),
  dravenor: (level, displayName) => new Dravenor(level, displayName),
  kael: (level, displayName) => new Kael(level, displayName),
  nyxara: (level, displayName) => new Nyxara(level, displayName),
  vorath: (level, displayName) => new Vorath(level, displayName),
};

export function createCharacter(id: CharacterId, level = 1, displayName?: string): Character {
  return FACTORIES[id](level, displayName);
}

/** Nome do adversário quando os dois lados usam o mesmo personagem. */
export function mirrorName(name: string): string {
  return `Sombra de ${name}`;
}

export function isCharacterId(value: unknown): value is CharacterId {
  return typeof value === 'string' && (CHARACTER_IDS as readonly string[]).includes(value);
}
