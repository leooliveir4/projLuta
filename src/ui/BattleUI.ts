import { DIFFICULTY_SETTINGS } from '../core/BattleAI.ts';
import { otherSide, type BattleEngine } from '../core/BattleEngine.ts';
import type { Character } from '../core/Character.ts';
import { computeDamage, expectedDamage } from '../core/damage.ts';
import { ITEMS } from '../core/items.ts';
import type { Ability, BattleAction, BattleEvent, ItemId, Side } from '../core/types.ts';
import type { BattleConfig } from '../game/BattleController.ts';
import { CHALLENGE_LENGTH } from '../progression/Progression.ts';
import type { SettingsStore } from '../progression/Settings.ts';
import { applyFrame, CHARACTER_ART, formArt, needsFlip, STAGES, type CharacterArt, type FormArt, type PoseName } from './art.ts';
import { ALL_STATUS_CLASSES, moveFor, STATUS_CLASSES, type Move } from './choreography.ts';
import { VfxLayer, type Direction, type Palette, type Point } from './Vfx.ts';
import type { AudioManager } from './AudioManager.ts';
import { h, plural, svg, wait } from './dom.ts';
import { ICONS, type IconName } from './icons.ts';
import { Screen } from './screens/Screen.ts';

export interface BattleUIOptions {
  engine: BattleEngine;
  audio: AudioManager;
  settings: SettingsStore;
  animationsActive: () => boolean;
  config: BattleConfig;
  onAction: (action: BattleAction) => void;
  onForfeit: () => void;
}

type MenuView = 'main' | 'abilities' | 'items';
type FloatVariant = 'damage' | 'critical' | 'heal' | 'energy' | 'buff' | 'debuff' | 'miss' | 'periodic';

interface InfoContent {
  icon: IconName;
  title: string;
  body: string;
  meta?: string[];
}

/** Barra de vida ou energia com rastro de dano. */
class MeterView {
  readonly element: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly trail: HTMLElement;
  private readonly text: HTMLElement;
  private readonly isHp: boolean;

  constructor(kind: 'hp' | 'energy' | 'influence', label: string, short: string) {
    this.isHp = kind === 'hp';
    this.fill = h('div', { class: 'meter__fill' });
    this.trail = h('div', { class: 'meter__trail' });
    this.text = h('span', { class: 'meter__text' });
    this.element = h(
      'div',
      { class: `meter meter--${kind}`, role: 'meter', 'aria-label': label, 'aria-valuemin': 0, 'data-label': short },
      this.trail,
      this.fill,
      this.text,
    );
  }

  set(value: number, max: number): void {
    const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
    const width = `${(ratio * 100).toFixed(2)}%`;
    this.fill.style.width = width;
    this.trail.style.width = width;
    this.text.textContent = `${Math.round(value)} / ${max}`;
    this.element.setAttribute('aria-valuenow', String(Math.round(value)));
    this.element.setAttribute('aria-valuemax', String(max));
    if (this.isHp) {
      this.element.classList.toggle('is-low', ratio <= 0.5 && ratio > 0.25);
      this.element.classList.toggle('is-critical', ratio <= 0.25);
    }
  }
}

/** Representação visual de um lado: cartão no topo e figura na arena. */
class FighterView {
  readonly side: Side;
  readonly character: Character;
  readonly art: CharacterArt;
  readonly card: HTMLElement;
  readonly figure: HTMLElement;
  readonly image: HTMLImageElement;
  private readonly portrait: HTMLImageElement;
  private readonly hp: MeterView;
  private readonly energy: MeterView;
  private readonly special: MeterView | null;
  private readonly cardBadges: HTMLElement;
  private readonly floats: HTMLElement;
  /** Camada que recebe as poses (inclinação, recuo, salto) sem mexer no espelhamento da arte. */
  private readonly poseLayer: HTMLElement;
  /** Estados persistentes desenhados sobre a arte (torre, escudo, brasas...). */
  private readonly turret: HTMLElement;
  private form = 'base';
  private basePose: PoseName | null = null;
  private poseTimer = 0;

  constructor(side: Side, character: Character, mirror = false) {
    this.side = side;
    this.character = character;
    this.art = CHARACTER_ART[character.id];
    this.hp = new MeterView('hp', `Vida de ${character.name}`, 'Vida');
    this.energy = new MeterView('energy', `${character.resourceName} de ${character.name}`, character.resourceName);
    const meter = character.specialMeter;
    this.special = meter ? new MeterView('influence', `${meter.label} de ${character.name}`, meter.label) : null;
    this.portrait = h('img', { class: 'fighter-card__portrait', src: this.art.portrait, alt: '', width: 96, height: 96, 'data-mirror': mirror ? 'true' : undefined });
    this.cardBadges = h('ul', { class: 'badges', 'aria-label': `Efeitos ativos em ${character.name}` });

    this.card = h(
      'section',
      { class: `fighter-card fighter-card--${side} plate plate--gold`, 'aria-label': side === 'player' ? 'Você' : 'Adversário' },
      this.portrait,
      h(
        'div',
        { class: 'fighter-card__body' },
        h(
          'div',
          { class: 'fighter-card__title' },
          h('h2', { class: 'fighter-card__name' }, character.name),
          h('span', { class: 'fighter-card__level' }, `Nv. ${character.level}`),
        ),
        this.hp.element,
        this.energy.element,
        this.special?.element ?? null,
        this.cardBadges,
      ),
    );

    this.image = h('img', {
      class: 'combatant__img',
      src: this.art.full,
      alt: `${character.name}, ${character.role.toLowerCase()}`,
      decoding: 'async',
    });
    this.floats = h('div', { class: 'combatant__floats', 'aria-hidden': 'true' });
    this.turret = h('div', { class: 'fx-turret', 'aria-hidden': 'true' }, h('span', { class: 'fx-turret__barrel' }));
    const status = h(
      'div',
      { class: 'combatant__status', 'aria-hidden': 'true' },
      h('div', { class: 'fx-dome' }),
      h('div', { class: 'fx-embers' }, ...Array.from({ length: 6 }, () => h('span'))),
      h('div', { class: 'fx-drips' }, ...Array.from({ length: 4 }, () => h('span'))),
      h('div', { class: 'fx-mark' }),
      h('div', { class: 'fx-slow' }),
      this.turret,
    );
    this.poseLayer = h('div', { class: 'combatant__pose' }, h('div', { class: 'fx-aura', 'aria-hidden': 'true' }), this.image, status);
    this.figure = h(
      'figure',
      { class: `combatant combatant--${side}`, 'data-character': character.id, 'data-mirror': mirror ? 'true' : undefined },
      h('div', { class: 'combatant__shadow' }),
      h('div', { class: 'combatant__ring' }),
      h('div', { class: 'combatant__body' }, this.poseLayer, h('div', { class: 'combatant__shield' })),
      this.floats,
    );
    this.figure.style.setProperty('--dir', String(this.direction));
    this.figure.style.setProperty('--c1', this.art.primary);
    this.figure.style.setProperty('--c2', this.art.secondary);
    this.frameArt(this.art);
    // Formas alternativas (Vaelith) já carregadas: a troca no meio da luta não pisca.
    for (const form of [this.art, ...Object.values(this.art.forms ?? {})]) {
      for (const src of [form.full, form.portrait, ...Object.values(form.poses ?? {})]) {
        if (src === this.art.full || src === this.art.portrait) continue;
        const preload = new Image();
        preload.decoding = 'async';
        preload.src = src;
      }
    }
  }

  /** Quem está no lado do jogador olha para a direita; o adversário, para a esquerda. */
  private get lookTo(): 'left' | 'right' {
    return this.side === 'player' ? 'right' : 'left';
  }

  /** Sentido dos golpes na tela. */
  get direction(): Direction {
    return this.side === 'player' ? 1 : -1;
  }

  get palette(): Palette {
    return { c1: this.art.primary, c2: this.art.secondary };
  }

  private get currentArt(): FormArt {
    return formArt(this.character.id, this.form);
  }

  /**
   * Pose temporária (ou permanente, sem `ms`). Sem arquivo de pose, a arte parada é
   * inclinada pelo CSS; com arquivo em `poses`, a arte é trocada durante a pose.
   */
  setPose(pose: PoseName | null, ms?: number): void {
    window.clearTimeout(this.poseTimer);
    this.applyPose(pose);
    if (ms !== undefined) this.poseTimer = window.setTimeout(() => this.applyPose(this.basePose), ms);
  }

  /** Volta para a pose de fundo, cancelando poses temporárias. */
  resetPose(): void {
    this.setPose(this.basePose);
  }

  /** Pose de fundo (guarda, vitória, derrota), para onde as poses temporárias voltam. */
  setBasePose(pose: PoseName | null): void {
    this.basePose = pose;
    this.setPose(pose);
  }

  private applyPose(pose: PoseName | null): void {
    if (pose) this.figure.dataset.pose = pose;
    else delete this.figure.dataset.pose;
    const art = this.currentArt;
    const drawn = pose ? art.poses?.[pose] : undefined;
    // Com arte de pose desenhada, a troca de imagem já mostra o movimento: a inclinação
    // feita em CSS é desligada para não exagerar.
    if (drawn) this.figure.dataset.poseArt = 'true';
    else delete this.figure.dataset.poseArt;
    const src = drawn || art.full;
    if (this.image.getAttribute('src') !== src) this.image.src = src;
  }

  /** Imagem fantasma que fica para trás numa esquiva ou num passo rápido. */
  ghost(): void {
    const copy = this.poseLayer.cloneNode(true) as HTMLElement;
    copy.classList.add('combatant__ghost');
    copy.querySelector('.combatant__status')?.remove();
    this.poseLayer.parentElement?.insertBefore(copy, this.poseLayer);
    window.setTimeout(() => copy.remove(), 600);
  }

  /** Liga as camadas visuais dos efeitos ativos (brasas, escudo, torre, marca...). */
  syncStatus(): void {
    const active = new Set(this.character.effects.map((effect) => STATUS_CLASSES[effect.id]).filter(Boolean));
    for (const name of ALL_STATUS_CLASSES) this.figure.classList.toggle(name, active.has(name));
  }

  /** Ponto da arena (em px) a partir de uma posição na imagem original. */
  private pointInArt(bounds: DOMRect, x: number, y: number): Point {
    const rect = this.image.getBoundingClientRect();
    const frame = this.currentArt.frame;
    const drawnHeight = Math.min(rect.height, rect.width / frame.aspect);
    const shownX = this.image.classList.contains('is-flipped') ? 1 - x : x;
    return { x: rect.left + rect.width * shownX - bounds.left, y: rect.bottom - drawnHeight * (1 - y) - bounds.top };
  }

  /** De onde saem os projéteis: a ponta da arma, ou o peito quando não há ponto definido. */
  muzzle(bounds: DOMRect): Point {
    const frame = this.currentArt.frame;
    return frame.muzzle ? this.pointInArt(bounds, frame.muzzle[0], frame.muzzle[1]) : this.center(bounds);
  }

  /** Largura em que a arte aparece de fato (sem as sobras laterais da caixa). */
  drawnWidth(): number {
    const rect = this.image.getBoundingClientRect();
    return Math.min(rect.width, rect.height * this.currentArt.frame.aspect);
  }

  /** Ponto no chão, entre os pés. */
  ground(bounds: DOMRect): Point {
    return this.pointInArt(bounds, this.currentArt.frame.anchorX, 0.98);
  }

  /** Centro da torre da Vexra, quando ela está em campo. */
  turretPoint(bounds: DOMRect): Point {
    const rect = this.turret.getBoundingClientRect();
    if (!rect.width) return this.center(bounds);
    return { x: rect.left + rect.width / 2 - bounds.left, y: rect.top + rect.height / 2 - bounds.top };
  }

  /** Enquadra a arte da forma atual: escala, ponto de apoio, máscara e espelhamento. */
  private frameArt(art: FormArt): void {
    const flipped = needsFlip(art, this.lookTo);
    this.image.classList.toggle('is-flipped', flipped);
    applyFrame(this.figure, art.frame, flipped);
  }

  setHp(value: number): void {
    this.hp.set(value, this.character.maxHp);
  }

  setEnergy(value: number): void {
    this.energy.set(value, this.character.maxEnergy);
  }

  setSpecial(value: number, max: number): void {
    this.special?.set(value, max);
    this.special?.element.classList.toggle('is-full', value >= max);
  }

  /** Troca a arte para a forma atual sem mudar posição, barras ou cartão. */
  setForm(formId: string): void {
    if (formId === this.form) return;
    this.form = formId;
    const art = formArt(this.character.id, formId);
    this.image.src = (this.figure.dataset.pose && art.poses?.[this.figure.dataset.pose as PoseName]) || art.full;
    this.portrait.src = art.portrait;
    this.frameArt(art);
    this.figure.dataset.form = formId;
    this.card.dataset.form = formId;
  }

  get portraitSrc(): string {
    return formArt(this.character.id, this.form).portrait;
  }

  sync(active: boolean): void {
    this.setHp(this.character.hp);
    this.setEnergy(this.character.energy);
    const meter = this.character.specialMeter;
    if (meter) this.setSpecial(meter.value, meter.max);
    this.setForm(this.character.formId);
    this.setGuard(this.character.isGuarding);
    this.renderBadges();
    this.card.classList.toggle('is-active', active);
    this.figure.classList.toggle('is-active', active);
    this.figure.classList.toggle('is-stunned', this.character.isStunned);
  }

  setGuard(on: boolean): void {
    this.figure.classList.toggle('is-guarding', on);
    if (on && !this.basePose) this.setBasePose('guard');
    else if (!on && this.basePose === 'guard') this.setBasePose(null);
  }

  renderBadges(): void {
    const badges = this.character.badges.map((badge) => {
      const turns = badge.turns ? ` (${plural(badge.turns, 'turno', 'turnos')})` : '';
      return h(
        'li',
        { class: `badge badge--${badge.kind}`, title: `${badge.label}${turns}: ${badge.description}` },
        h('span', { class: 'badge__label' }, badge.label),
        badge.turns ? h('span', { class: 'badge__turns', 'aria-label': plural(badge.turns, 'turno', 'turnos') }, badge.turns) : null,
      );
    });
    this.syncStatus();
    this.cardBadges.replaceChildren(...badges);
  }

  float(text: string, variant: FloatVariant): void {
    const node = h('span', { class: `float-text float-text--${variant}` }, text);
    node.style.setProperty('--drift', `${Math.round(Math.random() * 40 - 20)}px`);
    this.floats.append(node);
    window.setTimeout(() => node.remove(), 1600);
  }

  flash(className: string, duration: number): void {
    this.figure.classList.remove(className);
    void this.figure.offsetWidth;
    this.figure.classList.add(className);
    window.setTimeout(() => this.figure.classList.remove(className), duration);
  }

  /** Ponto do corpo (não do retângulo da imagem) onde golpes e projéteis acertam. */
  center(relativeTo: DOMRect): { x: number; y: number } {
    const rect = this.image.getBoundingClientRect();
    const frame = formArt(this.character.id, this.form).frame;
    const anchor = this.image.classList.contains('is-flipped') ? 1 - frame.anchorX : frame.anchorX;
    // Em telas estreitas a arte pode ser reduzida pela largura (object-fit: contain, apoiada embaixo).
    const drawnHeight = Math.min(rect.height, rect.width / frame.aspect);
    return {
      x: rect.left + rect.width * anchor - relativeTo.left,
      y: rect.bottom - drawnHeight * (1 - frame.focusY) - relativeTo.top,
    };
  }
}

/** Tela da arena: exibe o estado do combate, anima os eventos e coleta as ações do jogador. */
export class BattleUI extends Screen {
  private readonly options: BattleUIOptions;
  private readonly engine: BattleEngine;
  private readonly fighters: Record<Side, FighterView>;
  private readonly arena: HTMLElement;
  private readonly vfx: HTMLElement;
  private readonly effects: VfxLayer;
  /** Ação em andamento: define como os danos seguintes são desenhados. */
  private acting: { side: Side; move: Move } | null = null;
  /** Lutador que avançou até o adversário e ainda precisa voltar. */
  private engaged: { side: Side; animation: Animation } | null = null;
  private readonly banner: HTMLElement;
  private readonly turnLabel: HTMLElement;
  private readonly turnFlow: HTMLElement;
  private readonly turnOrder: HTMLOListElement;
  private readonly logList: HTMLOListElement;
  private readonly logPanel: HTMLDetailsElement;
  private readonly prompt: HTMLElement;
  private readonly menu: HTMLElement;
  private readonly notice: HTMLElement;
  private readonly info: HTMLElement;
  private readonly dialog: HTMLDialogElement;
  private menuView: MenuView = 'main';
  private playerTurn = false;
  private paused = false;
  private destroyed = false;
  private resumeWaiters: (() => void)[] = [];
  private noticeTimer = 0;
  private readonly loggedIds = new Set<number>();

  constructor(options: BattleUIOptions) {
    super('battle', 'Arena de combate');
    this.options = options;
    this.engine = options.engine;
    this.fighters = {
      player: new FighterView('player', this.engine.character('player')),
      enemy: new FighterView('enemy', this.engine.character('enemy'), options.config.playerId === options.config.enemyId),
    };

    this.turnLabel = h('span', { class: 'turn-badge__label' }, 'Preparar');
    this.turnFlow = h('div', { class: 'turn-badge__flow', 'aria-hidden': 'true' });
    this.turnOrder = h('ol', { class: 'turn-order__list' });
    this.vfx = h('div', { class: 'vfx', 'aria-hidden': 'true' });
    this.banner = h('div', { class: 'banner', 'aria-hidden': 'true' });
    this.logList = h('ol', { class: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions' });
    this.prompt = h('p', { class: 'actions__prompt', 'aria-live': 'polite' });
    this.menu = h('div', { class: 'actions__menu' });
    this.notice = h('p', { class: 'actions__notice', role: 'status' });
    this.info = h('section', { class: 'info-card plate', 'aria-live': 'polite', 'aria-label': 'Detalhes da ação' });
    this.dialog = this.buildPauseDialog();

    this.arena = h(
      'div',
      { class: 'arena' },
      h(
        'aside',
        { class: 'turn-order plate', 'aria-label': 'Ordem dos próximos turnos' },
        h('h2', { class: 'panel-title' }, 'Ordem do turno'),
        this.turnOrder,
      ),
      this.fighters.player.figure,
      this.fighters.enemy.figure,
      this.vfx,
      this.banner,
    );
    this.effects = new VfxLayer(this.vfx, this.arena);

    this.logPanel = h(
      'details',
      { class: 'log-panel plate' },
      h('summary', { class: 'panel-title' }, 'Histórico'),
      this.logList,
    );
    this.logPanel.open = window.matchMedia?.('(min-width: 900px)').matches ?? true;

    const pause = h(
      'button',
      { class: 'icon-button battle__pause', type: 'button', 'aria-label': 'Pausar', 'aria-keyshortcuts': 'Escape' },
      svg(ICONS.pause),
      h('span', { class: 'battle__pause-label' }, 'Pausa'),
    );
    pause.addEventListener('click', () => this.openPause());

    const stage = h(
      'div',
      { class: `battle__stage battle__stage--${options.config.stage}` },
      h(
        'header',
        { class: 'hud' },
        this.fighters.player.card,
        h(
          'div',
          { class: 'hud__center' },
          h('div', { class: 'turn-badge plate plate--gold' }, this.turnLabel, this.turnFlow),
          h('div', { class: 'hud__chips' }, ...this.modeChips(), pause),
        ),
        this.fighters.enemy.card,
      ),
      this.arena,
      h(
        'div',
        { class: 'command' },
        this.logPanel,
        h('section', { class: 'actions', 'aria-label': 'Ações' }, this.prompt, this.menu, this.notice),
        this.info,
      ),
    );
    stage.style.setProperty('--arena-image', `url("${STAGES[options.config.stage].image}")`);
    this.element.append(stage, this.dialog);

    this.renderMenu();
    this.showDefaultInfo();
    this.refresh();
  }

  protected override onMount(): void {
    this.listen('keydown', (event) => this.handleKey(event));
  }

  protected override onDestroy(): void {
    this.destroyed = true;
    this.paused = false;
    this.flushResumeWaiters();
    if (this.dialog.open) this.dialog.close();
  }

  /* API usada pelo controlador ----------------------------------------- */

  setPlayerTurn(enabled: boolean): void {
    this.playerTurn = enabled && !this.engine.isOver && this.engine.active === 'player';
    if (this.playerTurn) {
      this.menuView = 'main';
      this.renderMenu();
      this.prompt.textContent = `O que ${this.fighters.player.character.name} vai fazer?`;
      this.menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
    } else {
      this.renderMenu();
      if (this.engine.isOver) this.prompt.textContent = 'Combate encerrado.';
    }
    this.element.classList.toggle('is-player-turn', this.playerTurn);
  }

  showThinking(): void {
    this.prompt.textContent = `${this.fighters.enemy.character.name} está decidindo…`;
  }

  showNotice(text: string): void {
    this.notice.textContent = text;
    this.notice.classList.add('is-visible');
    window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => this.notice.classList.remove('is-visible'), 2800);
  }

  async waitWhilePaused(): Promise<void> {
    if (!this.paused || this.destroyed) return;
    await new Promise<void>((resolve) => this.resumeWaiters.push(resolve));
  }

  async playEvents(events: BattleEvent[]): Promise<void> {
    for (const event of events) {
      await this.waitWhilePaused();
      if (this.destroyed) return;
      await this.present(event);
      if (event.logId !== undefined) this.appendLog(event.logId);
    }
    await this.retreat();
    this.acting = null;
    if (!this.destroyed) this.refresh();
  }

  /* Apresentação dos eventos ------------------------------------------ */

  private async present(event: BattleEvent): Promise<void> {
    const audio = this.options.audio;
    switch (event.type) {
      case 'battle-start': {
        const { player, enemy } = this.fighters;
        this.refreshTurn();
        audio.play('turn');
        await this.showBanner(`${player.character.name} × ${enemy.character.name}`, 'versus', 1300);
        break;
      }
      case 'turn-start': {
        await this.retreat();
        this.acting = null;
        this.refreshTurn(event.turn, event.side);
        this.fighters[event.side].setGuard(false);
        this.renderTurnOrder(event.side);
        if (event.side === 'player') audio.play('turn');
        await this.delay(220);
        break;
      }
      case 'action': {
        await this.retreat();
        const actor = this.fighters[event.side];
        const name = actor.character.name;
        this.prompt.textContent =
          event.action.type === 'attack'
            ? `${name} ataca`
            : event.action.type === 'defend'
              ? `${name} defende`
              : `${name}: ${event.label}`;
        if (event.action.type === 'attack') {
          this.acting = { side: event.side, move: moveFor(actor.character.id, null) };
          await this.windUp(event.side, this.acting.move);
        } else if (event.action.type === 'ability') {
          const ability = actor.character.getAbility(event.action.abilityId);
          const move = moveFor(actor.character.id, event.action.abilityId, ability?.target ?? 'enemy');
          this.acting = { side: event.side, move };
          this.callout(actor, event.label);
          audio.play('ability');
          if (move.approach === 'self') await this.selfMove(actor, move);
          else await this.windUp(event.side, move);
        } else if (event.action.type === 'item') {
          this.acting = null;
          this.callout(actor, event.label);
          audio.play('buff');
          actor.setPose('cast', 420);
          await this.delay(380);
        } else {
          this.acting = null;
        }
        break;
      }
      case 'damage': {
        const target = this.fighters[event.target];
        if (this.animated) await this.drawHit(event.source, event.target, event.kind, event.critical, event.amount);
        const fixed = event.kind === 'periodic' || event.kind === 'turret';
        const variant: FloatVariant = event.critical ? 'critical' : fixed ? 'periodic' : 'damage';
        const label = event.critical ? `Crítico! −${event.amount}` : `−${event.amount}`;
        target.float(event.guarded ? `${label} (guarda)` : label, variant);
        target.flash(event.kind === 'periodic' ? 'is-burning' : 'is-hit', 420);
        audio.play(event.critical ? 'critical' : 'hit');
        target.setHp(event.hpAfter);
        await this.delay(event.critical ? 620 : 460);
        break;
      }
      case 'dodge': {
        const target = this.fighters[event.target];
        if (this.animated) await this.drawMiss(event.source, event.target);
        target.flash('is-dodging', 420);
        target.float('Esquivou!', 'miss');
        audio.play('dodge');
        await this.delay(460);
        break;
      }
      case 'heal': {
        const target = this.fighters[event.target];
        if (this.animated) this.effects.sparkle(target.center(this.arena.getBoundingClientRect()), { c1: '#8bffb2', c2: '#d6ffe4' });
        target.float(`+${event.amount}`, 'heal');
        target.flash('is-healing', 700);
        target.setHp(event.hpAfter);
        audio.play('heal');
        await this.delay(380);
        break;
      }
      case 'energy': {
        const target = this.fighters[event.target];
        target.setEnergy(event.energyAfter);
        if (event.amount > 0) target.float(`+${event.amount} ${target.character.resourceName.toLowerCase()}`, 'energy');
        await this.delay(event.amount > 0 ? 160 : 60);
        break;
      }
      case 'effect-applied': {
        const target = this.fighters[event.target];
        target.renderBadges();
        target.float(event.name, event.kind === 'buff' ? 'buff' : 'debuff');
        target.figure.classList.toggle('is-stunned', target.character.isStunned);
        audio.play(event.kind === 'buff' ? 'buff' : 'debuff');
        await this.delay(420);
        break;
      }
      case 'dispel': {
        const target = this.fighters[event.target];
        target.renderBadges();
        target.float('Bônus removidos', 'debuff');
        audio.play('debuff');
        await this.delay(380);
        break;
      }
      case 'meter': {
        const fighter = this.fighters[event.target];
        fighter.setSpecial(event.value, event.max);
        if (event.value >= event.max) fighter.float('Influência máxima', 'buff');
        await this.delay(120);
        break;
      }
      case 'form-change': {
        await this.retreat();
        const fighter = this.fighters[event.target];
        const eclipse = event.form !== 'base';
        if (this.animated) await this.drawFormChange(fighter, eclipse);
        fighter.setForm(event.form);
        fighter.renderBadges();
        fighter.flash(eclipse ? 'is-transforming' : 'is-empowered', 900);
        fighter.float(eclipse ? 'Eclipse!' : 'Forma normal', eclipse ? 'debuff' : 'buff');
        audio.play(eclipse ? 'ability' : 'buff');
        if (eclipse) await this.showBanner('Vaelith assume o controle', 'eclipse', 1200);
        else await this.delay(500);
        this.effects.dim(false);
        this.renderMenu();
        break;
      }
      case 'effect-expired':
        if (event.consumed) this.fighters[event.target].float(`${event.name} usado`, 'miss');
        this.fighters[event.target].renderBadges();
        this.fighters[event.target].figure.classList.toggle('is-stunned', this.fighters[event.target].character.isStunned);
        break;
      case 'guard': {
        const fighter = this.fighters[event.side];
        fighter.setGuard(true);
        fighter.renderBadges();
        fighter.float('Em guarda', 'buff');
        audio.play('guard');
        await this.delay(480);
        break;
      }
      case 'stunned': {
        const fighter = this.fighters[event.side];
        fighter.float('Atordoado!', 'debuff');
        audio.play('debuff');
        await this.delay(700);
        break;
      }
      case 'defeated': {
        await this.retreat();
        const fallen = this.fighters[event.side];
        fallen.setBasePose('defeat');
        fallen.figure.classList.add('is-defeated');
        if (this.animated) this.effects.shake(2);
        audio.play('knockout');
        await this.delay(900);
        break;
      }
      case 'battle-end': {
        const won = event.winner === 'player';
        this.fighters[event.winner].setBasePose('victory');
        this.setPlayerTurn(false);
        audio.play(won ? 'victory' : 'defeat');
        await this.showBanner(won ? 'Vitória' : 'Derrota', won ? 'victory' : 'defeat', 1500, true);
        break;
      }
      case 'note':
        await this.delay(200);
        break;
    }
  }

  /* Efeitos visuais ---------------------------------------------------- */

  private get animated(): boolean {
    return this.options.animationsActive();
  }

  private delay(ms: number): Promise<void> {
    return wait(this.animated ? ms : Math.min(120, ms * 0.3));
  }

  private get arenaBounds(): DOMRect {
    return this.arena.getBoundingClientRect();
  }

  /** Avanço curto e volta, usado no revide. */
  private async lunge(side: Side): Promise<void> {
    if (!this.animated) return;
    const fighter = this.fighters[side];
    fighter.setPose('strike', 320);
    await fighter.figure
      .animate(
        [
          { transform: 'translateX(0)' },
          { transform: `translateX(${fighter.direction * 70}px) scale(1.03)`, offset: 0.45 },
          { transform: 'translateX(0)' },
        ],
        { duration: 380, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' },
      )
      .finished.catch(() => undefined);
  }

  /**
   * Investida corpo a corpo: recua um pouco (antecipação), avança até perto do adversário
   * e fica lá enquanto os golpes são mostrados. `retreat` traz o lutador de volta.
   */
  private async approach(side: Side): Promise<void> {
    const actor = this.fighters[side];
    const target = this.fighters[otherSide(side)];
    const bounds = this.arenaBounds;
    // Para a uma distância que depende da largura das duas artes: lutadores largos
    // (Dravenor, Nyxara) não terminam sobrepostos ao adversário.
    const distance = Math.abs(target.center(bounds).x - actor.center(bounds).x);
    const stop = (actor.drawnWidth() + target.drawnWidth()) * 0.4;
    const dx = actor.direction * Math.max(distance * 0.2, distance - stop);
    actor.setPose('windup');
    window.setTimeout(() => actor.setPose('strike'), 150);
    const animation = actor.figure.animate(
      [
        { transform: 'translateX(0)' },
        { transform: `translateX(${-actor.direction * 16}px)`, offset: 0.38 },
        { transform: `translateX(${dx}px)` },
      ],
      { duration: 340, easing: 'cubic-bezier(0.55, 0, 0.25, 1)', fill: 'forwards' },
    );
    this.engaged = { side, animation };
    await animation.finished.catch(() => undefined);
  }

  /** Volta da investida, a partir de onde o lutador estiver. */
  private async retreat(): Promise<void> {
    const engaged = this.engaged;
    if (!engaged) return;
    this.engaged = null;
    const actor = this.fighters[engaged.side];
    const current = getComputedStyle(actor.figure).transform;
    const back = actor.figure.animate([{ transform: current === 'none' ? 'translateX(0)' : current }, { transform: 'translateX(0)' }], {
      duration: 240,
      easing: 'cubic-bezier(0.3, 0, 0.3, 1)',
    });
    engaged.animation.cancel();
    actor.setPose(null);
    actor.resetPose();
    await back.finished.catch(() => undefined);
  }

  /** Preparação do golpe, antes do dano: investida, mira ou conjuração. */
  private async windUp(side: Side, move: Move): Promise<void> {
    if (!this.animated) return;
    const actor = this.fighters[side];
    const target = this.fighters[otherSide(side)];
    const bounds = this.arenaBounds;
    switch (move.approach) {
      case 'melee':
        await this.approach(side);
        break;
      case 'ranged':
        actor.setPose('windup', 260);
        if (move.charge) await this.effects.charge(actor.muzzle(bounds), actor.palette, 520);
        else await wait(130);
        actor.setPose('cast', 360);
        break;
      case 'cast':
        if (move.groundWave) {
          actor.setPose('strike', 620);
          await wait(140);
          this.effects.shake(1);
          await this.effects.groundWave(actor.ground(bounds), target.ground(bounds), actor.palette);
        } else {
          actor.setPose('cast', 760);
          if (move.charge) await this.effects.charge(target.center(bounds), actor.palette, 520);
          else await wait(220);
        }
        // Marcas não causam dano: o símbolo aparece já na conjuração.
        if (move.impact === 'sigil') {
          this.effects.impact('sigil', target.center(bounds), actor.palette, actor.direction);
          this.options.audio.play('debuff');
        }
        break;
      case 'self':
        break;
    }
  }

  /** Habilidades sem alvo: escudo, torre, auras, passo etéreo, véu. */
  private async selfMove(actor: FighterView, move: Move): Promise<void> {
    if (!this.animated) {
      await this.delay(500);
      return;
    }
    const center = actor.center(this.arenaBounds);
    actor.setPose('cast', 560);
    switch (move.self) {
      case 'shield':
        this.effects.ring(center, { c1: '#bfe6ff', c2: '#5aa8ff' });
        break;
      case 'turret':
        this.effects.ring(actor.ground(this.arenaBounds), actor.palette);
        break;
      case 'power':
      case 'fury':
        this.effects.ring(center, actor.palette, true);
        actor.flash('is-empowered', 700);
        break;
      case 'armor':
        this.effects.ring(center, { c1: '#e3ecf8', c2: '#8798b4' });
        actor.flash('is-armored', 700);
        break;
      case 'step':
        actor.ghost();
        this.effects.ring(center, actor.palette);
        break;
      case 'veil':
        actor.ghost();
        this.effects.ring(center, actor.palette);
        break;
      case 'eclipse':
      default:
        break;
    }
    await wait(480);
  }

  /** Desenha o que causou o dano (projétil, corte, explosão) e a reação de quem sofreu. */
  private async drawHit(sourceSide: Side, targetSide: Side, kind: string, critical: boolean, amount: number): Promise<void> {
    const source = this.fighters[sourceSide];
    const target = this.fighters[targetSide];
    const bounds = this.arenaBounds;
    const at = target.center(bounds);
    if ((kind === 'basic' || kind === 'ability') && this.acting?.side === sourceSide) {
      const move = this.acting.move;
      if (move.approach === 'ranged' && move.projectile) {
        await this.effects.projectile(move.projectile, source.muzzle(bounds), at, source.palette);
      }
      if (move.impact === 'drain') this.effects.drain(at, source.center(bounds), source.palette);
      if (move.impact && move.impact !== 'sigil') this.effects.impact(move.impact, at, source.palette, source.direction, target.ground(bounds));
      this.effects.shake(Math.max(move.shake ?? 0, critical ? 2 : 0));
      if (move.flash) this.effects.flash(source.art.primary);
    } else if (kind === 'counter') {
      await this.lunge(sourceSide);
      this.effects.impact('slash', at, source.palette, source.direction);
    } else if (kind === 'turret') {
      await this.effects.projectile('bullet', source.turretPoint(bounds), at, source.palette);
      this.effects.impact('burst', at, source.palette, source.direction);
    } else if (critical) {
      this.effects.impact('burst', at, source.palette, source.direction);
    }
    // Pausa curta no crítico: o golpe "pesa" antes do número aparecer.
    if (critical) await wait(110);
    if (amount > 0 && kind !== 'periodic') target.setPose('hurt', 300);
  }

  /** Golpe que não acerta: o projétil passa e o alvo deixa um rastro. */
  private async drawMiss(sourceSide: Side, targetSide: Side): Promise<void> {
    const source = this.fighters[sourceSide];
    const target = this.fighters[targetSide];
    const bounds = this.arenaBounds;
    const move = this.acting?.side === sourceSide ? this.acting.move : null;
    if (move?.approach === 'ranged' && move.projectile) {
      const at = target.center(bounds);
      await this.effects.projectile(move.projectile, source.muzzle(bounds), { x: at.x + source.direction * 70, y: at.y - 50 }, source.palette);
    }
    target.ghost();
  }

  /** Transformação: a arena escurece, a energia converge e a arte troca no clarão. */
  private async drawFormChange(fighter: FighterView, eclipse: boolean): Promise<void> {
    const center = fighter.center(this.arenaBounds);
    const red: Palette = { c1: '#ff2e56', c2: '#5a0f24' };
    if (eclipse) {
      this.effects.dim(true);
      fighter.setPose('cast', 900);
      await this.effects.charge(center, red, 620);
      this.effects.flash('#ff2e56', 420);
      this.effects.ring(center, red, true);
      this.effects.shake(2);
    } else {
      this.effects.ring(center, { c1: '#ffd6dc', c2: '#ff2e56' });
      this.effects.flash('#ffe0e6', 260);
    }
  }

  private callout(fighter: FighterView, text: string): void {
    const node = h('div', { class: `callout callout--${fighter.side}` }, text);
    fighter.figure.append(node);
    window.setTimeout(() => node.remove(), 1500);
  }

  private async showBanner(text: string, variant: string, duration: number, persist = false): Promise<void> {
    this.banner.className = `banner banner--${variant} is-visible`;
    this.banner.textContent = text;
    await this.delay(duration);
    if (!persist) this.banner.classList.remove('is-visible');
  }

  /* Estado e HUD ------------------------------------------------------- */

  private refresh(): void {
    const active = this.engine.isOver ? null : this.engine.active;
    this.fighters.player.sync(active === 'player');
    this.fighters.enemy.sync(active === 'enemy');
    this.refreshTurn();
    this.renderTurnOrder();
    this.renderMenu();
  }

  private refreshTurn(turnNumber = this.engine.turn, active: Side = this.engine.active): void {
    const turn = Math.max(1, turnNumber);
    const current = this.fighters[active];
    const next = this.fighters[otherSide(active)];
    this.turnLabel.textContent = this.engine.isOver ? 'Fim' : `Turno ${turn}`;
    this.turnFlow.replaceChildren(
      h('img', { src: current.portraitSrc, alt: '', class: 'is-current' }),
      svg('<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5l8 7-8 7z"/></svg>'),
      h('img', { src: next.portraitSrc, alt: '' }),
    );
    this.fighters.player.card.classList.toggle('is-active', !this.engine.isOver && active === 'player');
    this.fighters.enemy.card.classList.toggle('is-active', !this.engine.isOver && active === 'enemy');
    this.fighters.player.figure.classList.toggle('is-active', !this.engine.isOver && active === 'player');
    this.fighters.enemy.figure.classList.toggle('is-active', !this.engine.isOver && active === 'enemy');
  }

  private renderTurnOrder(active: Side = this.engine.active): void {
    const items: HTMLElement[] = [];
    let side = active;
    for (let i = 0; i < 4; i += 1) {
      const fighter = this.fighters[side];
      const skipped = i === 1 && fighter.character.isStunned;
      items.push(
        h(
          'li',
          {
            class: `turn-order__item${i === 0 ? ' is-current' : ''}${skipped ? ' is-skipped' : ''}`,
            title: skipped ? `${fighter.character.name} (perde o turno)` : fighter.character.name,
          },
          h('img', { src: fighter.portraitSrc, alt: fighter.character.name }),
        ),
      );
      side = otherSide(side);
    }
    this.turnOrder.replaceChildren(...items);
  }

  private modeChips(): HTMLElement[] {
    const { config } = this.options;
    const mode =
      config.mode === 'challenge'
        ? `Desafio: etapa ${(config.challengeStage ?? 0) + 1} de ${CHALLENGE_LENGTH}`
        : 'Duelo';
    return [
      h('span', { class: 'chip' }, mode),
      h('span', { class: 'chip chip--muted' }, DIFFICULTY_SETTINGS[config.difficulty].label),
    ];
  }

  private appendLog(id: number): void {
    if (this.loggedIds.has(id)) return;
    const entry = this.engine.log.find(id);
    if (!entry) return;
    this.loggedIds.add(id);
    const item = h('li', { class: `log__entry log__entry--${entry.tone}` }, entry.text);
    this.logList.append(item);
    this.logList.scrollTop = this.logList.scrollHeight;
  }

  /* Menu de ações ----------------------------------------------------- */

  private renderMenu(): void {
    const player = this.fighters.player.character;
    const options = this.engine.availableActions('player');
    const enabled = this.playerTurn;
    let buttons: HTMLElement[];

    if (this.menuView === 'abilities') {
      buttons = player.abilities.map((ability, index) => {
        const option = options.find((o) => o.action.type === 'ability' && o.action.abilityId === ability.id);
        return this.abilityButton(ability, index, enabled && option?.available === true, option?.reason);
      });
      buttons.push(this.backButton());
    } else if (this.menuView === 'items') {
      const inventory = this.engine.inventory('player');
      buttons = inventory.entries().map(({ item, count }, index) =>
        this.itemButton(item.id, count, index, enabled && count > 0),
      );
      buttons.push(this.backButton());
    } else {
      const anyItem = this.engine.inventory('player').total > 0;
      buttons = [
        this.mainButton('attack', 'Atacar', '1', enabled, () => this.choose({ type: 'attack' }), this.attackInfo()),
        this.mainButton('ability', 'Habilidade', '2', enabled, () => this.openMenu('abilities'), this.abilityMenuInfo()),
        this.mainButton('defend', 'Defender', '3', enabled, () => this.choose({ type: 'defend' }), this.defendInfo()),
        this.mainButton('item', 'Item', '4', enabled && anyItem, () => this.openMenu('items'), this.itemMenuInfo()),
      ];
    }

    this.menu.className = `actions__menu actions__menu--${this.menuView}`;
    this.menu.replaceChildren(...buttons);
  }

  private mainButton(
    icon: IconName,
    label: string,
    key: string,
    enabled: boolean,
    onClick: () => void,
    info: InfoContent,
  ): HTMLButtonElement {
    const button = h(
      'button',
      { class: `action-button action-button--${icon}`, type: 'button', disabled: !enabled, 'aria-keyshortcuts': key },
      svg(ICONS[icon]),
      h('span', { class: 'action-button__label' }, label),
      h('kbd', { class: 'action-button__key', 'aria-hidden': 'true' }, key),
    );
    button.addEventListener('click', onClick);
    this.bindInfo(button, info);
    return button;
  }

  private abilityButton(ability: Ability, index: number, enabled: boolean, reason?: string): HTMLButtonElement {
    const player = this.fighters.player.character;
    const cooldown = player.getCooldown(ability.id);
    const restriction = ability.restriction?.(player) ?? null;
    const status = restriction
      ? ability.name === restriction
        ? 'Indisponível'
        : restriction.replace('Influência insuficiente: ', 'Influência ').replace(/\.$/, '')
      : cooldown > 0
        ? `Recarga: ${plural(cooldown, 'turno', 'turnos')}`
        : ability.cost > 0
          ? `Custo ${ability.cost}`
          : 'Sem custo';
    // Disponível, mas sem energia suficiente: o custo aparece em destaque.
    const short = !restriction && cooldown === 0 && ability.cost > player.energy;
    // Fora de recarga, o botão também mostra a recarga que a habilidade terá depois do uso.
    const baseCooldown =
      !restriction && cooldown === 0 && ability.cooldown > 0
        ? h('span', { class: 'skill-button__cd', title: `Recarga de ${plural(ability.cooldown, 'turno', 'turnos')} após o uso` }, svg(ICONS.hourglass), String(ability.cooldown))
        : null;
    const button = h(
      'button',
      {
        class: `skill-button${cooldown > 0 ? ' is-cooling' : ''}`,
        type: 'button',
        disabled: !enabled,
        title: reason,
        'aria-keyshortcuts': String(index + 1),
      },
      h('span', { class: 'skill-button__name' }, ability.name),
      h(
        'span',
        { class: `skill-button__meta${short ? ' is-short' : ''}` },
        h('span', { class: 'skill-button__status' }, svg(cooldown > 0 ? ICONS.hourglass : ICONS.drop), status),
        baseCooldown,
      ),
      h('kbd', { class: 'action-button__key', 'aria-hidden': 'true' }, String(index + 1)),
    );
    button.addEventListener('click', () => this.choose({ type: 'ability', abilityId: ability.id }));
    this.bindInfo(button, this.abilityInfo(ability, reason));
    return button;
  }

  private itemButton(itemId: ItemId, count: number, index: number, enabled: boolean): HTMLButtonElement {
    const item = ITEMS[itemId];
    const button = h(
      'button',
      { class: 'skill-button', type: 'button', disabled: !enabled, 'aria-keyshortcuts': String(index + 1) },
      h('span', { class: 'skill-button__name' }, item.name),
      h('span', { class: 'skill-button__meta' }, svg(ICONS.item), count > 0 ? `Restam ${count}` : 'Esgotado'),
      h('kbd', { class: 'action-button__key', 'aria-hidden': 'true' }, String(index + 1)),
    );
    button.addEventListener('click', () => this.choose({ type: 'item', itemId }));
    this.bindInfo(button, { icon: 'item', title: item.name, body: item.description, meta: [`Restam ${count}`, 'Consome o turno'] });
    return button;
  }

  private backButton(): HTMLButtonElement {
    const button = h(
      'button',
      { class: 'skill-button skill-button--back', type: 'button', 'aria-keyshortcuts': 'Escape' },
      svg(ICONS.back),
      h('span', { class: 'skill-button__name' }, 'Voltar'),
    );
    button.addEventListener('click', () => this.openMenu('main'));
    return button;
  }

  private openMenu(view: MenuView): void {
    if (!this.playerTurn && view !== 'main') return;
    this.options.audio.play('select');
    this.menuView = view;
    this.renderMenu();
    this.menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
    if (view === 'main') this.showDefaultInfo();
  }

  private choose(action: BattleAction): void {
    if (!this.playerTurn) return;
    this.options.audio.play('select');
    this.menuView = 'main';
    this.options.onAction(action);
  }

  /* Cartão de detalhes ------------------------------------------------ */

  private bindInfo(button: HTMLElement, info: InfoContent): void {
    const show = () => this.showInfo(info);
    button.addEventListener('mouseenter', show);
    button.addEventListener('focus', show);
  }

  private showInfo(info: InfoContent): void {
    this.info.replaceChildren(
      h(
        'div',
        { class: 'info-card__head' },
        h('span', { class: 'info-card__icon' }, svg(ICONS[info.icon])),
        h('h2', { class: 'info-card__title' }, info.title),
      ),
      h('p', { class: 'info-card__body' }, info.body),
    );
    if (info.meta?.length) {
      this.info.append(h('dl', { class: 'info-card__meta' }, ...info.meta.map((line) => this.metaRow(line))));
    }
  }

  /** "Rótulo: valor" vira uma linha com rótulo discreto e valor em destaque; o resto fica como nota. */
  private metaRow(line: string): HTMLElement {
    const split = line.indexOf(': ');
    if (split < 0) return h('div', { class: 'info-card__row info-card__row--note' }, h('dd', {}, line));
    return h(
      'div',
      { class: 'info-card__row' },
      h('dt', {}, line.slice(0, split)),
      h('dd', {}, line.slice(split + 2)),
    );
  }

  private showDefaultInfo(): void {
    const player = this.fighters.player.character;
    this.showInfo({
      icon: 'crown',
      title: player.passive.name,
      body: player.passive.description,
      meta: [`Passiva de ${player.name}`],
    });
  }

  private attackInfo(): InfoContent {
    const player = this.fighters.player.character;
    const enemy = this.fighters.enemy.character;
    const range = (roll: number) =>
      computeDamage({
        attack: player.attack,
        defense: enemy.defense,
        power: 1,
        varianceRoll: roll,
        critical: false,
        guarded: enemy.isGuarding,
        dealtModifier: player.outgoingDamageModifier('basic'),
        takenModifier: enemy.incomingDamageModifier('basic'),
        applyVariance: true,
      });
    return {
      icon: 'attack',
      title: 'Ataque básico',
      body: `Golpe que não consome ${player.resourceName.toLowerCase()}. Pode ser crítico (×1,5) ou ser esquivado.`,
      meta: [
        `Dano estimado: ${range(0)} a ${range(0.999)}`,
        `Crítico: ${Math.round(player.critChance * 100)}%`,
        `Chance de esquiva do alvo: ${Math.round(enemy.dodgeChanceAgainst(player, enemy.evasionEffect?.dodgeBonus ?? 0) * 100)}%`,
      ],
    };
  }

  private abilityMenuInfo(): InfoContent {
    const player = this.fighters.player.character;
    return {
      icon: 'ability',
      title: 'Habilidades',
      body: `Quatro técnicas exclusivas de ${player.name}. Consomem ${player.resourceName.toLowerCase()} e entram em recarga após o uso.`,
      meta: [`${player.resourceName}: ${player.energy} / ${player.maxEnergy}`],
    };
  }

  private defendInfo(): InfoContent {
    const player = this.fighters.player.character;
    return {
      icon: 'defend',
      title: 'Defender',
      body: 'Reduz em 50% o dano da próxima ação inimiga.',
      meta: [`Recupera ${player.defendEnergyGain} de ${player.resourceName.toLowerCase()}`],
    };
  }

  private itemMenuInfo(): InfoContent {
    const total = this.engine.inventory('player').total;
    return {
      icon: 'item',
      title: 'Itens',
      body: 'Consumíveis limitados a esta batalha. Usar um item consome o turno.',
      meta: [`Itens restantes: ${total}`],
    };
  }

  private abilityInfo(ability: Ability, reason?: string): InfoContent {
    const player = this.fighters.player.character;
    const enemy = this.fighters.enemy.character;
    const meta = [
      ability.cost > 0 ? `Custo: ${ability.cost} de ${player.resourceName.toLowerCase()}` : 'Sem custo de energia',
      ability.deferCooldown
        ? `Recarga: ${plural(ability.cooldown, 'turno', 'turnos')} após o fim da transformação`
        : `Recarga: ${plural(ability.cooldown, 'turno', 'turnos')}`,
    ];
    if (ability.estimatePower) {
      const estimate = expectedDamage(player, enemy, ability.estimatePower(player, enemy), 'ability', { defenseIgnore: ability.defenseIgnore });
      meta.push(`Dano estimado: ${Math.round(estimate)}`);
    }
    const meter = player.specialMeter;
    if (meter && ability.hints?.transformation) meta.push(`${meter.label}: ${meter.value} / ${meter.max}`);
    if (reason) meta.push(reason);
    return { icon: 'ability', title: ability.name, body: ability.description, meta };
  }

  /* Teclado e pausa ---------------------------------------------------- */

  private handleKey(event: KeyboardEvent): void {
    if (this.dialog.open || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (this.menuView !== 'main') this.openMenu('main');
      else this.openPause();
      return;
    }
    if (!this.playerTurn) return;
    const index = Number(event.key) - 1;
    if (Number.isInteger(index) && index >= 0 && index < 4) {
      const buttons = this.menu.querySelectorAll<HTMLButtonElement>('button');
      const target = buttons[index];
      if (target && !target.disabled && !target.classList.contains('skill-button--back')) {
        event.preventDefault();
        target.click();
      }
    }
  }

  private buildPauseDialog(): HTMLDialogElement {
    const settings = this.options.settings;
    const sound = h('input', { type: 'checkbox', id: 'pause-sound', checked: settings.value.soundEnabled });
    const motion = h('input', { type: 'checkbox', id: 'pause-motion', checked: settings.value.animationsEnabled });
    sound.addEventListener('change', () => settings.update({ soundEnabled: sound.checked }));
    motion.addEventListener('change', () => settings.update({ animationsEnabled: motion.checked }));

    const forfeit = h('button', { class: 'btn btn--danger', type: 'button' }, svg(ICONS.flag), 'Desistir da luta');
    let confirming = false;
    forfeit.addEventListener('click', () => {
      if (!confirming) {
        confirming = true;
        forfeit.lastChild!.textContent = 'Confirmar desistência';
        return;
      }
      this.dialog.close();
      this.options.onForfeit();
    });

    const resume = h('button', { class: 'btn btn--primary', type: 'button', 'data-autofocus': true }, svg(ICONS.play), 'Continuar');
    resume.addEventListener('click', () => this.dialog.close());

    const dialog = h(
      'dialog',
      { class: 'modal', 'aria-labelledby': 'pause-title' },
      h(
        'div',
        { class: 'modal__body' },
        h('h2', { class: 'modal__title', id: 'pause-title' }, 'Pausa'),
        h('label', { class: 'modal__row', for: 'pause-sound' }, 'Efeitos sonoros', h('span', { class: 'switch' }, sound, h('span'))),
        h('label', { class: 'modal__row', for: 'pause-motion' }, 'Animações', h('span', { class: 'switch' }, motion, h('span'))),
        h('div', { class: 'modal__actions' }, resume, forfeit),
        h('p', { class: 'modal__hint' }, 'Desistir conta como derrota e não rende experiência.'),
      ),
    );
    dialog.addEventListener('close', () => {
      this.paused = false;
      confirming = false;
      forfeit.lastChild!.textContent = 'Desistir da luta';
      this.flushResumeWaiters();
    });
    return dialog;
  }

  private openPause(): void {
    if (this.dialog.open || this.engine.isOver) return;
    this.paused = true;
    this.dialog.showModal();
  }

  private flushResumeWaiters(): void {
    for (const resolve of this.resumeWaiters.splice(0)) resolve();
  }
}
