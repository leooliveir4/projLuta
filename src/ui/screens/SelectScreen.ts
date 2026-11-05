import { DIFFICULTY_SETTINGS } from '../../core/BattleAI.ts';
import type { Character } from '../../core/Character.ts';
import { CHARACTER_IDS, createCharacter } from '../../core/roster.ts';
import type { CharacterId, Difficulty } from '../../core/types.ts';
import type { Game } from '../../game/Game.ts';
import { xpToNextLevel, type GameMode } from '../../progression/Progression.ts';
import { applyFrame, CHARACTER_ART, needsFlip, STAGE_IDS, STAGES, type StageId } from '../art.ts';
import { append, h, svg } from '../dom.ts';
import { ICONS } from '../icons.ts';
import { Screen } from './Screen.ts';

type Pick = CharacterId | 'random';

const STAT_ROWS = [
  { key: 'maxHp', label: 'Vida' },
  { key: 'attack', label: 'Ataque' },
  { key: 'defense', label: 'Defesa' },
  { key: 'speed', label: 'Velocidade' },
] as const;

/** Seleção de personagem. No duelo há um segundo passo para escolher o adversário. */
export class SelectScreen extends Screen {
  private readonly game: Game;
  private readonly mode: GameMode;
  private step: 'player' | 'enemy' = 'player';
  private playerPick: CharacterId = 'lyra';
  private current: Pick = 'lyra';
  private stage: StageId = 'arcane';
  private readonly heading: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly roster: HTMLElement;
  private readonly details: HTMLElement;
  private readonly confirm: HTMLButtonElement;
  private readonly stagePicker: HTMLElement;
  private readonly maxima: Record<(typeof STAT_ROWS)[number]['key'], number>;

  constructor(game: Game, mode: GameMode) {
    super('select', 'Seleção de personagem');
    this.game = game;
    this.mode = mode;
    this.maxima = { maxHp: 0, attack: 0, defense: 0, speed: 0 };
    for (const id of CHARACTER_IDS) {
      const sample = createCharacter(id);
      for (const row of STAT_ROWS) this.maxima[row.key] = Math.max(this.maxima[row.key], sample.stats[row.key]);
    }

    this.heading = h('h1', { class: 'screen-title' });
    this.hint = h('p', { class: 'screen-hint' });
    this.roster = h('div', { class: 'roster', role: 'radiogroup', 'aria-label': 'Personagens' });
    this.details = h('section', { class: 'details plate', 'aria-live': 'polite' });
    this.confirm = h('button', { class: 'btn btn--primary select__confirm', type: 'button' });
    this.confirm.addEventListener('click', () => this.confirmPick());
    this.stagePicker = this.stageControl();

    const back = h('button', { class: 'icon-button', type: 'button' }, svg(ICONS.back), 'Voltar');
    back.addEventListener('click', () => this.goBack());

    this.element.append(
      h(
        'div',
        { class: 'page page--wide' },
        h(
          'header',
          { class: 'page__header' },
          back,
          h('div', { class: 'page__heading' }, this.heading, this.hint),
          this.difficultyControl(),
        ),
        h('div', { class: 'select__layout' }, this.roster, this.details),
        h('footer', { class: 'page__footer' }, this.stagePicker, this.confirm),
      ),
    );
    this.render();
  }

  protected override onMount(): void {
    this.roster.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
  }

  private render(): void {
    const choosingEnemy = this.step === 'enemy';
    this.heading.textContent = choosingEnemy ? 'Escolha o adversário' : 'Escolha seu lutador';
    this.hint.textContent = choosingEnemy
      ? `Você lutará com ${createCharacter(this.playerPick).name}. Os dois começam no nível 1.`
      : this.mode === 'challenge'
        ? 'No desafio você enfrenta três adversários sorteados entre os outros lutadores e, por fim, um espelho de si mesmo.'
        : 'No duelo os dois lutadores entram no nível 1.';
    this.confirm.replaceChildren(svg(ICONS.attack), choosingEnemy || this.mode === 'challenge' ? 'Lutar' : 'Escolher adversário');
    this.stagePicker.hidden = !choosingEnemy;

    const picks: Pick[] = choosingEnemy ? [...CHARACTER_IDS, 'random'] : [...CHARACTER_IDS];
    this.roster.replaceChildren(...picks.map((pick) => this.card(pick)));
    this.renderDetails();
  }

  private card(pick: Pick): HTMLElement {
    const selected = pick === this.current;
    const button = h('button', {
      class: `roster-card${pick === 'random' ? ' roster-card--random' : ''}`,
      type: 'button',
      role: 'radio',
      'aria-checked': selected ? 'true' : 'false',
      tabindex: selected ? 0 : -1,
      'data-pick': pick,
    });

    if (pick === 'random') {
      button.append(
        h('span', { class: 'roster-card__icon' }, svg(ICONS.dice)),
        h('span', { class: 'roster-card__name' }, 'Aleatório'),
        h('span', { class: 'roster-card__role' }, 'Surpresa'),
      );
    } else {
      const character = this.preview(pick);
      append(
        button,
        h('img', { class: 'roster-card__image', src: CHARACTER_ART[pick].portrait, alt: '' }),
        h('span', { class: 'roster-card__name' }, character.name),
        h('span', { class: 'roster-card__role' }, character.role),
        this.mode === 'challenge' && this.step === 'player'
          ? h('span', { class: 'roster-card__level' }, `Nv. ${character.level}`)
          : null,
      );
    }

    button.addEventListener('click', () => this.select(pick));
    button.addEventListener('dblclick', () => this.confirmPick());
    button.addEventListener('keydown', (event) => this.handleRosterKey(event));
    return button;
  }

  private select(pick: Pick): void {
    if (pick === this.current) return;
    this.current = pick;
    this.game.audio.play('select');
    for (const node of this.roster.querySelectorAll<HTMLElement>('[data-pick]')) {
      const isCurrent = node.dataset.pick === pick;
      node.setAttribute('aria-checked', isCurrent ? 'true' : 'false');
      node.tabIndex = isCurrent ? 0 : -1;
    }
    this.renderDetails();
  }

  private handleRosterKey(event: KeyboardEvent): void {
    const nodes = [...this.roster.querySelectorAll<HTMLElement>('[data-pick]')];
    const index = nodes.findIndex((node) => node.dataset.pick === this.current);
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % nodes.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + nodes.length) % nodes.length;
    else if (event.key === 'Enter') {
      event.preventDefault();
      this.confirmPick();
      return;
    } else return;
    event.preventDefault();
    const target = nodes[next];
    this.select(target.dataset.pick as Pick);
    target.focus();
  }

  private renderDetails(): void {
    if (this.current === 'random') {
      this.details.replaceChildren(
        h(
          'div',
          { class: 'details__random' },
          svg(ICONS.dice),
          h('h2', { class: 'details__name' }, 'Adversário aleatório'),
          h('p', { class: 'details__text' }, `Um dos ${CHARACTER_IDS.length} lutadores será sorteado quando a luta começar.`),
        ),
      );
      return;
    }

    const character = this.preview(this.current);
    const progress = this.game.progression.characterProgress(character.id);
    const showProgress = this.mode === 'challenge' && this.step === 'player';

    // Na vitrine todos olham para o texto (à direita), como o lado do jogador na arena.
    const art = CHARACTER_ART[character.id];
    const flipped = needsFlip(art, 'right');
    const stage = h(
      'div',
      { class: 'details__stage', 'aria-hidden': 'true' },
      h('img', { class: `details__art${flipped ? ' is-flipped' : ''}`, src: art.full, alt: '', decoding: 'async' }),
    );
    applyFrame(stage, art.frame, flipped);

    this.details.replaceChildren(
      stage,
      h(
        'div',
        { class: 'details__content' },
        h(
          'header',
          { class: 'details__header' },
          h('h2', { class: 'details__name' }, character.name),
          h('span', { class: 'details__role' }, character.role),
        ),
        h('p', { class: 'details__text' }, character.description),
        h('p', { class: 'details__playstyle' }, character.playstyle),
        h(
          'dl',
          { class: 'details__traits' },
          h('div', {}, h('dt', {}, 'Foco'), h('dd', {}, character.focus)),
          h('div', {}, h('dt', {}, 'Fraqueza'), h('dd', {}, character.weakness)),
          h(
            'div',
            {},
            h('dt', {}, 'Complexidade'),
            h(
              'dd',
              { class: 'details__complexity', 'aria-label': `${character.complexity} de 5` },
              ...[1, 2, 3, 4, 5].map((step) => h('span', { class: step <= character.complexity ? 'is-on' : '' })),
            ),
          ),
        ),
        showProgress ? this.progressBlock(progress.level, progress.xp) : null,
        h(
          'dl',
          { class: 'stat-bars' },
          ...STAT_ROWS.map((row) => {
            const value = character.stats[row.key];
            return h(
              'div',
              { class: 'stat-bars__row' },
              h('dt', {}, row.label),
              h('dd', {}, h('span', { class: 'stat-bars__track' }, this.bar(value / this.maxima[row.key])), h('span', { class: 'stat-bars__value' }, value)),
            );
          }),
          h(
            'div',
            { class: 'stat-bars__row' },
            h('dt', {}, character.resourceName),
            h(
              'dd',
              { class: 'stat-bars__resource' },
              character.energyRegen > 0
                ? `${character.maxEnergy}, recupera ${character.energyRegen} por turno`
                : `${character.maxEnergy}, começa vazia e enche em combate`,
            ),
          ),
        ),
        h(
          'section',
          { class: 'kit' },
          h('h3', { class: 'kit__title' }, 'Passiva'),
          h('p', { class: 'kit__item' }, h('strong', {}, character.passive.name), character.passive.description),
          h('h3', { class: 'kit__title' }, 'Habilidades'),
          h(
            'ul',
            { class: 'kit__list' },
            ...character.abilities.map((ability) =>
              h(
                'li',
                { class: 'kit__item' },
                h('strong', {}, ability.name),
                h('span', { class: 'kit__cost' }, `${ability.cost} de ${character.resourceName.toLowerCase()}, recarga ${ability.cooldown}`),
                ability.description,
              ),
            ),
          ),
        ),
      ),
    );
  }

  private progressBlock(level: number, xp: number): HTMLElement {
    const needed = xpToNextLevel(level);
    const fill = h('div', { class: 'meter__fill' });
    fill.style.width = needed > 0 ? `${(xp / needed) * 100}%` : '100%';
    return h(
      'div',
      { class: 'details__progress' },
      h('span', { class: 'details__level' }, `Nível ${level}`),
      h('div', { class: 'meter meter--xp', role: 'meter', 'aria-label': 'Experiência', 'aria-valuenow': xp, 'aria-valuemax': needed || xp }, fill),
      h('span', { class: 'details__xp' }, needed > 0 ? `${xp} / ${needed} XP` : 'Nível máximo'),
    );
  }

  private bar(ratio: number): HTMLElement {
    const fill = h('span', { class: 'stat-bars__fill' });
    fill.style.width = `${Math.round(Math.min(1, Math.max(0.08, ratio)) * 100)}%`;
    return fill;
  }

  private preview(id: CharacterId): Character {
    const level = this.mode === 'challenge' && this.step === 'player' ? this.game.progression.characterProgress(id).level : 1;
    return createCharacter(id, level);
  }

  private difficultyControl(): HTMLElement {
    const group = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Dificuldade' });
    for (const difficulty of ['easy', 'normal', 'hard'] as Difficulty[]) {
      const input = h('input', {
        type: 'radio',
        name: 'select-difficulty',
        value: difficulty,
        checked: this.game.settings.value.difficulty === difficulty,
      });
      input.addEventListener('change', () => this.game.settings.update({ difficulty }));
      group.append(h('label', {}, input, h('span', {}, DIFFICULTY_SETTINGS[difficulty].label)));
    }
    return h('div', { class: 'page__aside' }, h('span', { class: 'page__aside-label' }, 'Dificuldade'), group);
  }

  private stageControl(): HTMLElement {
    const group = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Cenário' });
    for (const stage of STAGE_IDS) {
      const input = h('input', { type: 'radio', name: 'select-stage', value: stage, checked: this.stage === stage });
      input.addEventListener('change', () => {
        this.stage = stage;
      });
      group.append(h('label', {}, input, h('span', {}, STAGES[stage].name)));
    }
    return h('div', { class: 'page__aside select__stage' }, h('span', { class: 'page__aside-label' }, 'Cenário'), group);
  }

  private confirmPick(): void {
    this.game.audio.play('select');
    if (this.step === 'player') {
      if (this.current === 'random') return;
      this.playerPick = this.current;
      if (this.mode === 'challenge') {
        this.game.beginChallenge(this.playerPick);
        return;
      }
      this.step = 'enemy';
      this.current = 'random';
      this.render();
      this.roster.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
      return;
    }
    this.game.startDuel(this.playerPick, this.current, this.stage);
  }

  private goBack(): void {
    if (this.step === 'enemy') {
      this.step = 'player';
      this.current = this.playerPick;
      this.render();
      return;
    }
    this.game.showMenu();
  }
}
