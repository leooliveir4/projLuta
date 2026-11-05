import { MAX_LEVEL } from '../core/Character.ts';
import { CHARACTER_IDS, isCharacterId } from '../core/roster.ts';
import { CHALLENGE_LENGTH, createDefaultSave, SAVE_VERSION, type SaveData } from './Progression.ts';

/** Subconjunto da API Storage usado pelo jogo (permite substituir em testes). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SAVE_KEY = 'jogo-de-luta:progresso';

/** Registro de uma migração feita ao carregar um save antigo. */
export interface SaveMigration {
  from: number;
  to: number;
  message: string;
}

/**
 * Saves da versão 1 pertencem ao elenco antigo (quatro personagens). As estatísticas
 * gerais são mantidas; níveis por personagem e desafio em andamento são descartados,
 * porque aqueles personagens não existem mais.
 */
const V1_MIGRATION_MESSAGE =
  'O elenco mudou. Suas estatísticas gerais foram mantidas; níveis dos lutadores antigos e o desafio em andamento foram descartados.';

/** Lê e grava o progresso no localStorage, tolerando dados ausentes ou corrompidos. */
export class SaveManager {
  private readonly storage: KeyValueStorage | null;
  private readonly key: string;
  private migration: SaveMigration | null = null;

  constructor(storage: KeyValueStorage | null, key = SAVE_KEY) {
    this.storage = storage;
    this.key = key;
  }

  static browserStorage(): KeyValueStorage | null {
    try {
      const storage = globalThis.localStorage;
      const probe = '__jogo-de-luta__';
      storage.setItem(probe, '1');
      storage.removeItem(probe);
      return storage;
    } catch {
      return null;
    }
  }

  get isAvailable(): boolean {
    return this.storage !== null;
  }

  /** Migração feita no último carregamento, para avisar o jogador uma única vez. */
  get lastMigration(): SaveMigration | null {
    return this.migration;
  }

  load(): SaveData {
    if (!this.storage) return createDefaultSave();
    try {
      this.migration = null;
      const raw = this.storage.getItem(this.key);
      if (!raw) return createDefaultSave();
      const parsed: unknown = JSON.parse(raw);
      if (isRecord(parsed) && parsed.version === 1) {
        const migrated = migrateFromV1(parsed);
        this.migration = { from: 1, to: SAVE_VERSION, message: V1_MIGRATION_MESSAGE };
        this.save(migrated);
        return migrated;
      }
      return sanitize(parsed);
    } catch {
      return createDefaultSave();
    }
  }

  save(data: SaveData): boolean {
    if (!this.storage) return false;
    try {
      this.storage.setItem(this.key, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  hasSave(): boolean {
    return this.storage?.getItem(this.key) != null;
  }

  clear(): void {
    this.storage?.removeItem(this.key);
  }
}

/** Reconstrói um SaveData válido a partir de qualquer valor, preservando o que for aproveitável. */
function sanitize(value: unknown): SaveData {
  const result = createDefaultSave();
  if (!isRecord(value) || value.version !== SAVE_VERSION) return result;

  if (isRecord(value.characters)) {
    for (const id of CHARACTER_IDS) {
      const entry = value.characters[id];
      if (!isRecord(entry)) continue;
      result.characters[id] = {
        level: clampInt(entry.level, 1, MAX_LEVEL, 1),
        xp: clampInt(entry.xp, 0, Number.MAX_SAFE_INTEGER, 0),
        wins: clampInt(entry.wins, 0, Number.MAX_SAFE_INTEGER, 0),
        losses: clampInt(entry.losses, 0, Number.MAX_SAFE_INTEGER, 0),
      };
    }
  }

  sanitizeStats(value.stats, result);

  const challenge = value.challenge;
  if (
    isRecord(challenge) &&
    isCharacterId(challenge.characterId) &&
    Array.isArray(challenge.opponents) &&
    challenge.opponents.length === CHALLENGE_LENGTH &&
    challenge.opponents.every(isCharacterId)
  ) {
    result.challenge = {
      characterId: challenge.characterId,
      opponents: [...challenge.opponents],
      stage: clampInt(challenge.stage, 0, CHALLENGE_LENGTH - 1, 0),
    };
  }

  return result;
}

/** Mantém apenas as estatísticas gerais de um save da versão 1. */
function migrateFromV1(value: Record<string, unknown>): SaveData {
  const result = createDefaultSave();
  sanitizeStats(value.stats, result);
  return result;
}

function sanitizeStats(value: unknown, result: SaveData): void {
  if (!isRecord(value)) return;
  const stats = result.stats;
  for (const key of Object.keys(stats) as (keyof typeof stats)[]) {
    stats[key] = clampInt(value[key], 0, Number.MAX_SAFE_INTEGER, 0);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}
