import type { Difficulty } from '../core/types.ts';
import type { KeyValueStorage } from './SaveManager.ts';

export interface GameSettings {
  /** Volume de 0 a 1. */
  volume: number;
  soundEnabled: boolean;
  animationsEnabled: boolean;
  difficulty: Difficulty;
}

export const SETTINGS_KEY = 'jogo-de-luta:opcoes';

export const DEFAULT_SETTINGS: Readonly<GameSettings> = {
  volume: 0.6,
  soundEnabled: true,
  animationsEnabled: true,
  difficulty: 'normal',
};

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

/** Preferências do jogador, salvas separadamente do progresso. */
export class SettingsStore {
  private readonly storage: KeyValueStorage | null;
  private current: GameSettings;
  private readonly listeners = new Set<(settings: GameSettings) => void>();

  constructor(storage: KeyValueStorage | null) {
    this.storage = storage;
    this.current = this.read();
  }

  get value(): Readonly<GameSettings> {
    return this.current;
  }

  update(changes: Partial<GameSettings>): void {
    this.current = normalize({ ...this.current, ...changes });
    try {
      this.storage?.setItem(SETTINGS_KEY, JSON.stringify(this.current));
    } catch {
      // Sem armazenamento disponível, as opções valem apenas para esta sessão.
    }
    for (const listener of this.listeners) listener(this.current);
  }

  subscribe(listener: (settings: GameSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private read(): GameSettings {
    try {
      const raw = this.storage?.getItem(SETTINGS_KEY);
      return raw ? normalize(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }
}

function normalize(value: Partial<Record<keyof GameSettings, unknown>>): GameSettings {
  const volume = typeof value.volume === 'number' && Number.isFinite(value.volume) ? value.volume : DEFAULT_SETTINGS.volume;
  return {
    volume: Math.min(1, Math.max(0, volume)),
    soundEnabled: typeof value.soundEnabled === 'boolean' ? value.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
    animationsEnabled:
      typeof value.animationsEnabled === 'boolean' ? value.animationsEnabled : DEFAULT_SETTINGS.animationsEnabled,
    difficulty: DIFFICULTIES.includes(value.difficulty as Difficulty)
      ? (value.difficulty as Difficulty)
      : DEFAULT_SETTINGS.difficulty,
  };
}
