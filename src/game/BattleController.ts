import { BattleAI } from '../core/BattleAI.ts';
import { BattleEngine } from '../core/BattleEngine.ts';
import { createCharacter, mirrorName } from '../core/roster.ts';
import type { BattleAction, CharacterId, CombatStatistics, Difficulty } from '../core/types.ts';
import type { GameMode } from '../progression/Progression.ts';
import type { SettingsStore } from '../progression/Settings.ts';
import type { StageId } from '../ui/art.ts';
import type { AudioManager } from '../ui/AudioManager.ts';
import { BattleUI } from '../ui/BattleUI.ts';
import { wait } from '../ui/dom.ts';

export interface BattleConfig {
  mode: GameMode;
  playerId: CharacterId;
  playerLevel: number;
  enemyId: CharacterId;
  enemyLevel: number;
  difficulty: Difficulty;
  stage: StageId;
  challengeStage?: number;
}

export interface BattleOutcome {
  config: BattleConfig;
  won: boolean;
  forfeited: boolean;
  turns: number;
  player: CombatStatistics;
  enemy: CombatStatistics;
}

interface ControllerDeps {
  audio: AudioManager;
  settings: SettingsStore;
  animationsActive: () => boolean;
  onFinish: (outcome: BattleOutcome) => void;
}

/**
 * Conecta motor, IA e interface: repassa a ação do jogador ao motor,
 * espera as animações terminarem e então executa os turnos do adversário.
 */
export class BattleController {
  readonly ui: BattleUI;
  private readonly engine: BattleEngine;
  private readonly ai: BattleAI;
  private readonly config: BattleConfig;
  private readonly deps: ControllerDeps;
  private busy = true;
  private destroyed = false;
  private finished = false;

  constructor(config: BattleConfig, deps: ControllerDeps) {
    this.config = config;
    this.deps = deps;
    const player = createCharacter(config.playerId, config.playerLevel);
    const isMirror = config.playerId === config.enemyId;
    this.engine = new BattleEngine({
      player,
      enemy: createCharacter(config.enemyId, config.enemyLevel, isMirror ? mirrorName(player.name) : undefined),
    });
    this.ai = new BattleAI(config.difficulty);
    this.ui = new BattleUI({
      engine: this.engine,
      audio: deps.audio,
      settings: deps.settings,
      animationsActive: deps.animationsActive,
      config,
      onAction: (action) => void this.handlePlayerAction(action),
      onForfeit: () => this.forfeit(),
    });
  }

  async start(): Promise<void> {
    const events = this.engine.start();
    await this.ui.playEvents(events);
    await this.continueBattle();
  }

  destroy(): void {
    this.destroyed = true;
    this.ui.destroy();
  }

  private async handlePlayerAction(action: BattleAction): Promise<void> {
    if (this.busy || this.destroyed || this.engine.isOver || this.engine.active !== 'player') return;

    const result = this.engine.perform('player', action);
    if (!result.accepted) {
      this.ui.showNotice(result.reason);
      return;
    }

    this.busy = true;
    this.ui.setPlayerTurn(false);
    await this.ui.playEvents(result.events);
    await this.continueBattle();
  }

  /** Executa os turnos do adversário até ser a vez do jogador ou o combate terminar. */
  private async continueBattle(): Promise<void> {
    while (!this.destroyed && !this.engine.isOver && this.engine.active === 'enemy') {
      this.ui.setPlayerTurn(false);
      this.ui.showThinking();
      await wait(this.deps.animationsActive() ? 700 : 250);
      await this.ui.waitWhilePaused();
      if (this.destroyed) return;

      const action = this.ai.chooseAction(this.engine, 'enemy');
      let result = this.engine.perform('enemy', action);
      if (!result.accepted) result = this.engine.perform('enemy', { type: 'attack' });
      if (result.accepted) await this.ui.playEvents(result.events);
    }

    if (this.destroyed) return;
    if (this.engine.isOver) {
      await wait(this.deps.animationsActive() ? 1400 : 600);
      this.finish(false);
      return;
    }

    this.busy = false;
    this.ui.setPlayerTurn(true);
  }

  private forfeit(): void {
    if (this.finished) return;
    this.finish(true);
  }

  private finish(forfeited: boolean): void {
    if (this.finished || this.destroyed) return;
    this.finished = true;
    this.deps.onFinish({
      config: this.config,
      won: !forfeited && this.engine.winner === 'player',
      forfeited,
      turns: this.engine.turn,
      player: { ...this.engine.statistics('player') },
      enemy: { ...this.engine.statistics('enemy') },
    });
  }
}
