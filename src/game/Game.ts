import { MathRandom, pickRandom } from '../core/random.ts';
import { CHARACTER_IDS } from '../core/roster.ts';
import type { CharacterId } from '../core/types.ts';
import { Progression, type GameMode } from '../progression/Progression.ts';
import { SaveManager } from '../progression/SaveManager.ts';
import { SettingsStore } from '../progression/Settings.ts';
import { challengeStage, MENU_BACKDROP, type StageId } from '../ui/art.ts';
import { AudioManager } from '../ui/AudioManager.ts';
import { BattleUI } from '../ui/BattleUI.ts';
import { h, prefersReducedMotion } from '../ui/dom.ts';
import { ChallengeScreen } from '../ui/screens/ChallengeScreen.ts';
import { CreditsScreen } from '../ui/screens/CreditsScreen.ts';
import { MenuScreen } from '../ui/screens/MenuScreen.ts';
import { OptionsScreen } from '../ui/screens/OptionsScreen.ts';
import { ResultScreen } from '../ui/screens/ResultScreen.ts';
import type { Screen } from '../ui/screens/Screen.ts';
import { SelectScreen } from '../ui/screens/SelectScreen.ts';
import { StatsScreen } from '../ui/screens/StatsScreen.ts';
import { BattleController, type BattleConfig, type BattleOutcome } from './BattleController.ts';

/** Controlador da aplicação: navegação entre telas, persistência e início das batalhas. */
export class Game {
  readonly settings: SettingsStore;
  readonly progression: Progression;
  readonly audio: AudioManager;

  private readonly root: HTMLElement;
  private readonly backdrop: HTMLElement;
  private readonly screenHost: HTMLElement;
  private readonly saves: SaveManager;
  private readonly random = new MathRandom();
  private screen: Screen | null = null;
  private pendingNotice: string | null;
  private battle: BattleController | null = null;
  private lastConfig: BattleConfig | null = null;

  constructor(root: HTMLElement) {
    const storage = SaveManager.browserStorage();
    this.root = root;
    this.saves = new SaveManager(storage);
    this.settings = new SettingsStore(storage);
    this.progression = new Progression(this.saves.load());
    this.pendingNotice = this.saves.lastMigration?.message ?? null;
    this.audio = new AudioManager(this.settings);

    this.backdrop = h('div', { class: 'backdrop', 'aria-hidden': 'true' });
    this.backdrop.style.backgroundImage = `url("${MENU_BACKDROP}")`;
    this.screenHost = h('div', { class: 'screen-host' });
    root.replaceChildren(this.backdrop, this.screenHost);

    this.applyMotionPreference();
    this.settings.subscribe(() => this.applyMotionPreference());
    window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => this.applyMotionPreference());
    root.addEventListener('pointerdown', () => this.audio.unlock(), { once: true });
    root.addEventListener('keydown', () => this.audio.unlock(), { once: true });
  }

  /** Aviso de migração de save, exibido uma única vez no menu. */
  get saveNotice(): string | null {
    const notice = this.pendingNotice;
    this.pendingNotice = null;
    return notice;
  }

  get storageAvailable(): boolean {
    return this.saves.isAvailable;
  }

  /** Animações só rodam se estiverem ativadas nas opções e o sistema não pedir movimento reduzido. */
  get animationsActive(): boolean {
    return this.settings.value.animationsEnabled && !prefersReducedMotion();
  }

  start(): void {
    this.showMenu();
  }

  showMenu(): void {
    this.show(new MenuScreen(this), true);
  }

  showSelect(mode: GameMode): void {
    this.show(new SelectScreen(this, mode), true);
  }

  showOptions(onBack: () => void = () => this.showMenu()): void {
    this.show(new OptionsScreen(this, onBack), true);
  }

  showCredits(): void {
    this.show(new CreditsScreen(this), true);
  }

  showStats(): void {
    this.show(new StatsScreen(this), true);
  }

  showChallenge(): void {
    if (!this.progression.activeChallenge) {
      this.showMenu();
      return;
    }
    this.show(new ChallengeScreen(this), true);
  }

  beginChallenge(characterId: CharacterId): void {
    this.progression.startChallenge(characterId, this.random);
    this.persist();
    this.showChallenge();
  }

  abandonChallenge(): void {
    this.progression.abandonChallenge();
    this.persist();
    this.showMenu();
  }

  startDuel(playerId: CharacterId, enemyId: CharacterId | 'random', stage: StageId): void {
    const enemy = enemyId === 'random' ? pickRandom(CHARACTER_IDS, this.random) : enemyId;
    this.startBattle({
      mode: 'duel',
      playerId,
      playerLevel: 1,
      enemyId: enemy,
      enemyLevel: 1,
      difficulty: this.settings.value.difficulty,
      stage,
    });
  }

  startChallengeBattle(): void {
    const run = this.progression.activeChallenge;
    const opponent = this.progression.currentChallengeOpponent();
    if (!run || !opponent) {
      this.showMenu();
      return;
    }
    this.startBattle({
      mode: 'challenge',
      playerId: run.characterId,
      playerLevel: this.progression.characterProgress(run.characterId).level,
      enemyId: opponent.id,
      enemyLevel: opponent.level,
      difficulty: this.settings.value.difficulty,
      stage: challengeStage(run.stage),
      challengeStage: run.stage,
    });
  }

  /** Revanche: repete o mesmo confronto (no desafio, tenta a etapa atual de novo). */
  rematch(): void {
    if (!this.lastConfig) {
      this.showMenu();
      return;
    }
    if (this.lastConfig.mode === 'challenge') {
      this.startChallengeBattle();
      return;
    }
    this.startBattle({ ...this.lastConfig, difficulty: this.settings.value.difficulty });
  }

  resetProgress(): void {
    this.saves.clear();
    const fresh = new Progression();
    Object.assign(this.progression.data, fresh.data);
    this.persist();
  }

  persist(): void {
    this.saves.save(this.progression.data);
  }

  private startBattle(config: BattleConfig): void {
    this.lastConfig = config;
    const controller = new BattleController(config, {
      audio: this.audio,
      animationsActive: () => this.animationsActive,
      settings: this.settings,
      onFinish: (outcome) => this.finishBattle(outcome),
    });
    this.show(controller.ui, false);
    this.battle = controller;
    void controller.start();
  }

  private finishBattle(outcome: BattleOutcome): void {
    const update = this.progression.record({
      mode: outcome.config.mode,
      characterId: outcome.config.playerId,
      enemyLevel: outcome.config.enemyLevel,
      difficulty: outcome.config.difficulty,
      won: outcome.won,
      forfeited: outcome.forfeited,
      damageDealt: outcome.player.damageDealt,
      criticalHits: outcome.player.criticalHits,
    });
    this.persist();
    if (outcome.forfeited) {
      this.showMenu();
      return;
    }
    this.show(new ResultScreen(this, outcome, update), true);
  }

  private show(screen: Screen | BattleUI, dimBackdrop: boolean): void {
    if (this.battle && this.battle.ui !== screen) {
      this.battle.destroy();
      this.battle = null;
    }
    this.screen?.destroy();
    this.screen = screen;
    this.backdrop.classList.toggle('backdrop--blur', dimBackdrop);
    this.backdrop.hidden = !dimBackdrop;
    screen.mount(this.screenHost);
  }

  private applyMotionPreference(): void {
    this.root.ownerDocument.documentElement.classList.toggle('reduce-motion', !this.animationsActive);
  }
}
