import { MAX_LEVEL } from '../core/Character.ts';
import { shuffle, type RandomSource } from '../core/random.ts';
import { CHARACTER_IDS } from '../core/roster.ts';
import type { CharacterId, Difficulty } from '../core/types.ts';

export type GameMode = 'duel' | 'challenge';

export interface CharacterProgress {
  level: number;
  xp: number;
  wins: number;
  losses: number;
}

export interface PlayerStatistics {
  battles: number;
  wins: number;
  losses: number;
  currentStreak: number;
  bestStreak: number;
  damageDealt: number;
  criticalHits: number;
  challengesCompleted: number;
}

export interface ChallengeRun {
  characterId: CharacterId;
  stage: number;
  opponents: CharacterId[];
}

export const SAVE_VERSION = 2;

export interface SaveData {
  version: typeof SAVE_VERSION;
  characters: Record<CharacterId, CharacterProgress>;
  stats: PlayerStatistics;
  challenge: ChallengeRun | null;
}

export interface BattleReport {
  mode: GameMode;
  characterId: CharacterId;
  enemyLevel: number;
  difficulty: Difficulty;
  won: boolean;
  forfeited: boolean;
  damageDealt: number;
  criticalHits: number;
}

export interface ExperienceResult {
  gained: number;
  levelBefore: number;
  levelAfter: number;
  xpAfter: number;
  xpToNext: number;
}

export interface ProgressUpdate {
  experience: ExperienceResult;
  challengeStageCleared: number | null;
  challengeCompleted: boolean;
}

export const CHALLENGE_LENGTH = 4;
export const CHALLENGE_COMPLETION_XP = 150;
const CHALLENGE_LEVEL_OFFSETS = [-1, 0, 1, 1] as const;
const DIFFICULTY_XP: Record<Difficulty, number> = { easy: 0.75, normal: 1, hard: 1.3 };

export function xpToNextLevel(level: number): number {
  if (level >= MAX_LEVEL) return 0;
  return 100 + (level - 1) * 50;
}

/** XP de uma batalha. Derrotas rendem uma parcela pequena; desistências não rendem nada. */
export function battleExperience(report: Pick<BattleReport, 'mode' | 'enemyLevel' | 'difficulty' | 'won' | 'forfeited'>): number {
  if (report.forfeited) return 0;
  const base = 60 + 15 * report.enemyLevel;
  const modeBonus = report.mode === 'challenge' ? 1.2 : 1;
  const value = base * DIFFICULTY_XP[report.difficulty] * modeBonus;
  return Math.round(report.won ? value : value * 0.25);
}

export function addExperience(progress: CharacterProgress, amount: number): ExperienceResult {
  const levelBefore = progress.level;
  progress.xp += Math.max(0, Math.round(amount));
  while (progress.level < MAX_LEVEL && progress.xp >= xpToNextLevel(progress.level)) {
    progress.xp -= xpToNextLevel(progress.level);
    progress.level += 1;
  }
  if (progress.level >= MAX_LEVEL) progress.xp = 0;
  return {
    gained: Math.max(0, Math.round(amount)),
    levelBefore,
    levelAfter: progress.level,
    xpAfter: progress.xp,
    xpToNext: xpToNextLevel(progress.level),
  };
}

export function challengeEnemyLevel(playerLevel: number, stage: number): number {
  const offset = CHALLENGE_LEVEL_OFFSETS[Math.min(stage, CHALLENGE_LEVEL_OFFSETS.length - 1)];
  return Math.min(MAX_LEVEL, Math.max(1, playerLevel + offset));
}

export function createDefaultSave(): SaveData {
  const characters = {} as Record<CharacterId, CharacterProgress>;
  for (const id of CHARACTER_IDS) characters[id] = { level: 1, xp: 0, wins: 0, losses: 0 };
  return {
    version: SAVE_VERSION,
    characters,
    stats: {
      battles: 0,
      wins: 0,
      losses: 0,
      currentStreak: 0,
      bestStreak: 0,
      damageDealt: 0,
      criticalHits: 0,
      challengesCompleted: 0,
    },
    challenge: null,
  };
}

/**
 * Regras de progressão: experiência, níveis, estatísticas e modo desafio.
 * Opera sobre um SaveData; quem persiste os dados é o SaveManager.
 */
export class Progression {
  readonly data: SaveData;

  constructor(data: SaveData = createDefaultSave()) {
    this.data = data;
  }

  characterProgress(id: CharacterId): Readonly<CharacterProgress> {
    return this.data.characters[id];
  }

  get activeChallenge(): Readonly<ChallengeRun> | null {
    return this.data.challenge;
  }

  get hasPlayed(): boolean {
    return this.data.stats.battles > 0;
  }

  /** Inicia um desafio: três outros lutadores sorteados e, por fim, a sombra do próprio personagem. */
  startChallenge(characterId: CharacterId, random: RandomSource): ChallengeRun {
    const others = shuffle(
      CHARACTER_IDS.filter((id) => id !== characterId),
      random,
    ).slice(0, CHALLENGE_LENGTH - 1);
    const run: ChallengeRun = { characterId, stage: 0, opponents: [...others, characterId] };
    this.data.challenge = run;
    return run;
  }

  abandonChallenge(): void {
    this.data.challenge = null;
  }

  currentChallengeOpponent(): { id: CharacterId; level: number } | null {
    const run = this.data.challenge;
    if (!run) return null;
    const playerLevel = this.data.characters[run.characterId].level;
    return { id: run.opponents[run.stage], level: challengeEnemyLevel(playerLevel, run.stage) };
  }

  record(report: BattleReport): ProgressUpdate {
    const stats = this.data.stats;
    const character = this.data.characters[report.characterId];

    stats.battles += 1;
    stats.damageDealt += report.damageDealt;
    stats.criticalHits += report.criticalHits;
    if (report.won) {
      stats.wins += 1;
      stats.currentStreak += 1;
      stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
      character.wins += 1;
    } else {
      stats.losses += 1;
      stats.currentStreak = 0;
      character.losses += 1;
    }

    let xp = battleExperience(report);
    let challengeStageCleared: number | null = null;
    let challengeCompleted = false;

    const run = this.data.challenge;
    if (report.mode === 'challenge' && run && run.characterId === report.characterId && report.won) {
      challengeStageCleared = run.stage;
      run.stage += 1;
      if (run.stage >= run.opponents.length) {
        challengeCompleted = true;
        stats.challengesCompleted += 1;
        xp += CHALLENGE_COMPLETION_XP;
        this.data.challenge = null;
      }
    }

    return { experience: addExperience(character, xp), challengeStageCleared, challengeCompleted };
  }
}
