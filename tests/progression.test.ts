import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../src/core/random.ts';
import {
  addExperience,
  battleExperience,
  CHALLENGE_COMPLETION_XP,
  challengeEnemyLevel,
  createDefaultSave,
  Progression,
  xpToNextLevel,
  type BattleReport,
} from '../src/progression/Progression.ts';
import { SAVE_KEY, SaveManager } from '../src/progression/SaveManager.ts';
import { DEFAULT_SETTINGS, SETTINGS_KEY, SettingsStore } from '../src/progression/Settings.ts';
import { MemoryStorage } from './helpers.ts';

const report = (overrides: Partial<BattleReport> = {}): BattleReport => ({
  mode: 'duel',
  characterId: 'lyra',
  enemyLevel: 1,
  difficulty: 'normal',
  won: true,
  forfeited: false,
  damageDealt: 500,
  criticalHits: 2,
  ...overrides,
});

describe('experiência e níveis', () => {
  it('a curva de XP cresce 50 por nível e para no nível máximo', () => {
    expect(xpToNextLevel(1)).toBe(100);
    expect(xpToNextLevel(2)).toBe(150);
    expect(xpToNextLevel(10)).toBe(0);
  });

  it('XP considera vitória, nível do adversário, dificuldade e modo', () => {
    expect(battleExperience(report())).toBe(75);
    expect(battleExperience(report({ won: false }))).toBe(19);
    expect(battleExperience(report({ forfeited: true, won: false }))).toBe(0);
    expect(battleExperience(report({ difficulty: 'hard' }))).toBe(98);
    expect(battleExperience(report({ mode: 'challenge', enemyLevel: 3 }))).toBe(126);
  });

  it('sobe vários níveis de uma vez e respeita o máximo', () => {
    const progress = { level: 1, xp: 0, wins: 0, losses: 0 };
    const result = addExperience(progress, 260);
    expect(result).toMatchObject({ levelBefore: 1, levelAfter: 3, xpAfter: 10, xpToNext: 200 });
    addExperience(progress, 1_000_000);
    expect(progress.level).toBe(10);
    expect(progress.xp).toBe(0);
  });

  it('o nível dos adversários do desafio acompanha o do jogador', () => {
    expect([0, 1, 2, 3].map((stage) => challengeEnemyLevel(5, stage))).toEqual([4, 5, 6, 6]);
    expect(challengeEnemyLevel(1, 0)).toBe(1);
    expect(challengeEnemyLevel(10, 3)).toBe(10);
  });
});

describe('modo desafio e estatísticas', () => {
  it('cria uma sequência com três outros lutadores sorteados e a sombra no final', () => {
    const progression = new Progression();
    const run = progression.startChallenge('vexra', new SeededRandom(4));
    expect(run.opponents).toHaveLength(4);
    expect(run.opponents[3]).toBe('vexra');
    const others = run.opponents.slice(0, 3);
    expect(new Set(others).size).toBe(3);
    expect(others).not.toContain('vexra');
    const other = new Progression().startChallenge('vexra', new SeededRandom(99));
    expect(other.opponents.slice(0, 3)).not.toEqual(others);
  });

  it('vitórias avançam a etapa, derrotas permitem tentar de novo e a conclusão rende bônus', () => {
    const progression = new Progression();
    progression.startChallenge('lyra', new SeededRandom(1));
    const challenge = report({ mode: 'challenge' });

    expect(progression.record({ ...challenge, won: false }).challengeStageCleared).toBeNull();
    expect(progression.activeChallenge?.stage).toBe(0);

    for (let stage = 0; stage < 3; stage += 1) {
      expect(progression.record(challenge).challengeStageCleared).toBe(stage);
    }
    const final = progression.record(challenge);
    expect(final.challengeCompleted).toBe(true);
    expect(final.experience.gained).toBe(battleExperience(challenge) + CHALLENGE_COMPLETION_XP);
    expect(progression.activeChallenge).toBeNull();
    expect(progression.data.stats).toMatchObject({ battles: 5, wins: 4, losses: 1, bestStreak: 4, challengesCompleted: 1 });
  });

  it('registra sequência de vitórias e estatísticas por personagem', () => {
    const progression = new Progression();
    progression.record(report());
    progression.record(report());
    progression.record(report({ won: false }));
    progression.record(report({ characterId: 'kael' }));
    expect(progression.data.stats).toMatchObject({ currentStreak: 1, bestStreak: 2, damageDealt: 2000, criticalHits: 8 });
    expect(progression.characterProgress('lyra')).toMatchObject({ wins: 2, losses: 1 });
    expect(progression.characterProgress('kael').wins).toBe(1);
  });
});

describe('persistência', () => {
  it('salva e recarrega o progresso no armazenamento local', () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    const progression = new Progression(manager.load());
    progression.startChallenge('nyxara', new SeededRandom(2));
    progression.record(report({ characterId: 'nyxara', mode: 'challenge' }));
    expect(manager.save(progression.data)).toBe(true);

    const restored = new SaveManager(storage).load();
    expect(restored).toEqual(progression.data);
    expect(restored.challenge?.stage).toBe(1);
  });

  it('dados corrompidos ou inválidos voltam a valores seguros', () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);

    storage.setItem(SAVE_KEY, '{ isso não é json');
    expect(manager.load()).toEqual(createDefaultSave());

    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 2,
        characters: { lyra: { level: 99, xp: -5, wins: 3, losses: 'muitas' } },
        stats: { battles: 7, wins: Infinity },
        challenge: { characterId: 'desconhecido', stage: 2, opponents: ['lyra'] },
      }),
    );
    const loaded = manager.load();
    expect(loaded.characters.lyra).toEqual({ level: 10, xp: 0, wins: 3, losses: 0 });
    expect(loaded.characters.kael).toEqual({ level: 1, xp: 0, wins: 0, losses: 0 });
    expect(loaded.stats.battles).toBe(7);
    expect(loaded.stats.wins).toBe(0);
    expect(loaded.challenge).toBeNull();
    expect(manager.lastMigration).toBeNull();
  });

  it('migra saves da versão 1 (elenco antigo) mantendo só as estatísticas gerais', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        characters: { ahri: { level: 5, xp: 40, wins: 9, losses: 2 } },
        stats: { battles: 12, wins: 9, losses: 3, currentStreak: 2, bestStreak: 5, damageDealt: 9000, criticalHits: 14, challengesCompleted: 1 },
        challenge: { characterId: 'ahri', stage: 2, opponents: ['jinx', 'jax', 'renekton', 'ahri'] },
      }),
    );
    const manager = new SaveManager(storage);
    const loaded = manager.load();
    expect(loaded.version).toBe(2);
    expect(loaded.stats).toMatchObject({ battles: 12, wins: 9, bestStreak: 5, challengesCompleted: 1 });
    expect(loaded.characters).toEqual(createDefaultSave().characters);
    expect(loaded.challenge).toBeNull();
    expect(manager.lastMigration).toMatchObject({ from: 1, to: 2 });
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).version).toBe(2);
    expect(new SaveManager(storage).load()).toEqual(loaded);
  });

  it('funciona sem armazenamento disponível e permite apagar o progresso', () => {
    const offline = new SaveManager(null);
    expect(offline.load()).toEqual(createDefaultSave());
    expect(offline.save(createDefaultSave())).toBe(false);

    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    manager.save(createDefaultSave());
    expect(manager.hasSave()).toBe(true);
    manager.clear();
    expect(manager.hasSave()).toBe(false);
  });

  it('opções são normalizadas, salvas e notificadas', () => {
    const storage = new MemoryStorage();
    storage.setItem(SETTINGS_KEY, JSON.stringify({ volume: 7, soundEnabled: 'sim', difficulty: 'impossível' }));
    const settings = new SettingsStore(storage);
    expect(settings.value).toEqual({ ...DEFAULT_SETTINGS, volume: 1 });

    const seen: string[] = [];
    settings.subscribe((value) => seen.push(value.difficulty));
    settings.update({ difficulty: 'hard', animationsEnabled: false });
    expect(seen).toEqual(['hard']);
    expect(JSON.parse(storage.getItem(SETTINGS_KEY) ?? '{}')).toMatchObject({ difficulty: 'hard', animationsEnabled: false });
  });
});
