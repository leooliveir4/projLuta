import { DIFFICULTY_SETTINGS } from '../../core/BattleAI.ts';
import type { Character } from '../../core/Character.ts';
import { CHARACTER_IDS, createCharacter } from '../../core/roster.ts';
import type { CharacterId, Difficulty } from '../../core/types.ts';
import type { Game } from '../../game/Game.ts';
import { xpToNextLevel, type GameMode } from '../../progression/Progression.ts';
import { abilityIcon } from '../abilityIcons.ts';
import { applyFrame, CHARACTER_ART, needsFlip, STAGE_IDS, STAGES, type StageId } from '../art.ts';
import { append, h, plural, svg } from '../dom.ts';
import { ICONS } from '../icons.ts';
import { Screen } from './Screen.ts';

type Pick = CharacterId | 'random';

const STAT_ROWS = [
  { key: 'maxHp', label: 'Vida' },
  { key: 'attack', label: 'Ataque' },
  { key: 'defense', label: 'Defesa' },
  { key: 'speed', label: 'Velocidade' },
] as const;

/**
 * Seleção de personagem em destaque: a arte grande do lutador escolhido à esquerda, os dados
 * reais do jogo (descrição, atributos, passiva e habilidades) ao lado e, embaixo, uma faixa
 * com os seis retratos para alternar. No duelo, o mesmo layout serve para escolher o
 * adversário, com a opção Aleatório.
 */
export class SelectScreen extends Screen {
  private readonly game: Game;
  private readonly mode: GameMode;
  private step: 'player' | 'enemy' = 'player';
  private playerPick: CharacterId = 'lyra';
  private current: Pick = 'lyra';
  private stage: StageId = 'arcane';
  private readonly heading: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly hero: HTMLElement;
  private readonly artPanel: HTMLElement;
  private readonly info: HTMLElement;
  private readonly kit: HTMLElement;
  private readonly roster: HTMLElement;
  private readonly confirm: HTMLButtonElement;
  private readonly stagePicker: HTMLElement;
  /** Prévia do cenário escolhido, atrás da tela, enquanto se escolhe o adversário. */
  private readonly scenery: HTMLElement;
  private readonly maxima: Record<(typeof STAT_ROWS)[number]['key'], number>;
  private readonly artObserver: ResizeObserver | null;

  constructor(game: Game, mode: GameMode) {
    super('select', 'Seleção de personagem');
    this.game = game;
    this.mode = mode;
    this.maxima = { maxHp: 0, attack: 0, defense: 0, speed: 0 };
    for (const id of CHARACTER_IDS) {
      const sample = createCharacter(id);
      for (const row of STAT_ROWS) this.maxima[row.key] = Math.max(this.maxima[row.key], sample.stats[row.key]);
    }

    this.heading = h('h1', { class: 'screen-title select__title' });
    this.hint = h('p', { class: 'screen-hint select__hint' });
    this.artPanel = h('div', { class: 'select__art-panel', 'aria-hidden': 'true' });
    this.info = h('section', { class: 'select__info', 'aria-live': 'polite' });
    this.kit = h('section', { class: 'select__kit plate', 'aria-label': 'Habilidades' });
    this.hero = h('div', { class: 'select__hero' }, this.artPanel, this.info, this.kit);
    this.roster = h('div', { class: 'select__roster', role: 'radiogroup', 'aria-label': 'Personagens' });
    this.confirm = h('button', { class: 'btn btn--primary select__confirm', type: 'button' });
    this.confirm.addEventListener('click', () => this.confirmPick());
    this.stagePicker = this.stageControl();
    this.scenery = h('div', { class: 'select__scenery', 'aria-hidden': 'true' });

    const back = h('button', { class: 'icon-button select__back', type: 'button' }, svg(ICONS.back), 'Voltar');
    back.addEventListener('click', () => this.goBack());

    this.element.append(
      this.scenery,
      h(
        'div',
        { class: 'select' },
        h(
          'header',
          { class: 'select__top' },
          this.stagePicker,
          h('div', { class: 'select__heading' }, this.heading, this.hint),
          h('div', { class: 'select__options' }, this.difficultyControl()),
        ),
        this.hero,
        h('footer', { class: 'select__bar' }, back, h('div', { class: 'select__strip' }, this.roster), this.confirm),
      ),
    );
    this.artObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.placeArt());
    this.artObserver?.observe(this.artPanel);
    this.preloadArt();
    this.render();
  }

  protected override onMount(): void {
    this.roster.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
    this.placeArt();
  }

  protected override onDestroy(): void {
    this.artObserver?.disconnect();
  }

  /* Montagem ---------------------------------------------------------------- */

  private render(): void {
    const choosingEnemy = this.step === 'enemy';
    this.heading.textContent = choosingEnemy ? 'Escolha o adversário' : 'Escolha seu lutador';
    this.hint.textContent = choosingEnemy
      ? `Você lutará com ${createCharacter(this.playerPick).name}. Os dois começam no nível 1.`
      : this.mode === 'challenge'
        ? 'No desafio você enfrenta três adversários sorteados entre os outros lutadores e, por fim, um espelho de si mesmo.'
        : 'No duelo os dois lutadores entram no nível 1.';
    this.confirm.replaceChildren(
      svg(ICONS.attack),
      h('span', {}, choosingEnemy || this.mode === 'challenge' ? 'Lutar' : 'Escolher adversário'),
    );
    this.stagePicker.hidden = !choosingEnemy;
    this.scenery.hidden = !choosingEnemy;
    this.showScenery();

    const picks: Pick[] = choosingEnemy ? [...CHARACTER_IDS, 'random'] : [...CHARACTER_IDS];
    this.roster.replaceChildren(...picks.map((pick) => this.tile(pick)));
    this.renderSelection();
  }

  /** Retrato da faixa inferior. */
  private tile(pick: Pick): HTMLElement {
    const selected = pick === this.current;
    const button = h('button', {
      class: `select-tile${pick === 'random' ? ' select-tile--random' : ''}`,
      type: 'button',
      role: 'radio',
      'aria-checked': selected ? 'true' : 'false',
      tabindex: selected ? 0 : -1,
      'data-pick': pick,
    });

    if (pick === 'random') {
      button.setAttribute('aria-label', 'Aleatório: um adversário sorteado');
      button.append(h('span', { class: 'select-tile__icon' }, svg(ICONS.dice)), h('span', { class: 'select-tile__name' }, 'Aleatório'));
    } else {
      const character = this.preview(pick);
      button.setAttribute('aria-label', `${character.name}, ${character.role}`);
      button.style.setProperty('--c1', CHARACTER_ART[pick].primary);
      append(
        button,
        h('img', { class: 'select-tile__image', src: CHARACTER_ART[pick].portrait, alt: '', decoding: 'async' }),
        h('span', { class: 'select-tile__name' }, character.name),
        this.mode === 'challenge' && this.step === 'player'
          ? h('span', { class: 'select-tile__level' }, `Nv. ${character.level}`)
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
      if (isCurrent) this.revealTile(node);
    }
    this.renderSelection();
  }

  /** Rola só a faixa de retratos (no celular), sem mover a página. */
  private revealTile(node: HTMLElement): void {
    const strip = this.roster;
    const left = node.offsetLeft - strip.offsetLeft;
    const right = left + node.offsetWidth;
    if (left < strip.scrollLeft) strip.scrollTo({ left: left - 8 });
    else if (right > strip.scrollLeft + strip.clientWidth) strip.scrollTo({ left: right - strip.clientWidth + 8 });
  }

  private handleRosterKey(event: KeyboardEvent): void {
    const nodes = [...this.roster.querySelectorAll<HTMLElement>('[data-pick]')];
    const index = nodes.findIndex((node) => node.dataset.pick === this.current);
    let next = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % nodes.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + nodes.length) % nodes.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = nodes.length - 1;
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

  /** Atualiza arte, informações e habilidades para a escolha atual. */
  private renderSelection(): void {
    const pick = this.current;
    this.hero.dataset.showing = pick;
    if (pick === 'random') {
      this.hero.style.removeProperty('--c1');
      this.hero.style.removeProperty('--c2');
      this.renderRandom();
      return;
    }
    const art = CHARACTER_ART[pick];
    this.hero.style.setProperty('--c1', art.primary);
    this.hero.style.setProperty('--c2', art.secondary);
    const character = this.preview(pick);
    this.renderArt(character.id);
    this.renderInfo(character);
    this.renderKit(character);
  }

  private renderArt(id: CharacterId): void {
    // Na vitrine todos olham para o texto (à direita), como o lado do jogador na arena.
    const art = CHARACTER_ART[id];
    const flipped = needsFlip(art, 'right');
    const image = h('img', { class: `select__art${flipped ? ' is-flipped' : ''}`, src: art.full, alt: '', decoding: 'async' });
    applyFrame(this.artPanel, art.frame, flipped);
    this.artPanel.replaceChildren(h('div', { class: 'select__art-glow' }), image);
    this.placeArt();
  }

  /**
   * Centraliza o corpo (e não o retângulo do arquivo) no painel, mas sem deixar a arte passar
   * das bordas dele: nas artes com arma comprida, como a da Vexra, o canhão não invade o texto.
   */
  private placeArt(): void {
    const image = this.artPanel.querySelector<HTMLElement>('.select__art');
    if (!image || this.current === 'random') return;
    const { width, height } = this.artPanel.getBoundingClientRect();
    if (!width || !height) return;
    const art = CHARACTER_ART[this.current];
    const anchor = needsFlip(art, 'right') ? 1 - art.frame.anchorX : art.frame.anchorX;
    const boxWidth = Math.min(height * art.frame.aspect, width);
    const center = Math.min(Math.max(width / 2 + (0.5 - anchor) * boxWidth, boxWidth / 2), width - boxWidth / 2);
    image.style.left = `${center}px`;
  }

  private renderInfo(character: Character): void {
    const showProgress = this.mode === 'challenge' && this.step === 'player';
    const progress = this.game.progression.characterProgress(character.id);
    this.info.replaceChildren();
    append(
      this.info,
      h(
        'header',
        { class: 'select__identity' },
        h('h2', { class: 'select__name' }, character.name),
        h('p', { class: 'select__role' }, character.role),
      ),
      showProgress ? this.progressBlock(progress.level, progress.xp) : null,
      h('p', { class: 'select__text' }, character.description),
      h('p', { class: 'select__playstyle' }, character.playstyle),
      h(
        'dl',
        { class: 'select__traits' },
        h('div', {}, h('dt', {}, 'Foco'), h('dd', {}, character.focus)),
        h('div', {}, h('dt', {}, 'Fraqueza'), h('dd', {}, character.weakness)),
        h(
          'div',
          {},
          h('dt', {}, 'Complexidade'),
          h(
            'dd',
            { class: 'select__complexity', 'aria-label': `${character.complexity} de 5` },
            ...[1, 2, 3, 4, 5].map((step) => h('span', { class: step <= character.complexity ? 'is-on' : '' })),
          ),
        ),
      ),
      h('h3', { class: 'select__section' }, svg(ICONS.chart), 'Atributos'),
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
        { class: 'select__passive' },
        h('h3', { class: 'select__section' }, svg(ICONS.crown), 'Passiva'),
        h('p', {}, h('strong', { class: 'select__passive-name' }, character.passive.name), ' ', character.passive.description),
      ),
    );
  }

  private renderKit(character: Character): void {
    const resource = character.resourceName.toLowerCase();
    this.kit.replaceChildren(
      h('h3', { class: 'select__section select__kit-title' }, svg(ICONS.ability), 'Habilidades'),
      h(
        'ul',
        { class: 'select__abilities' },
        ...character.abilities.map((ability) =>
          h(
            'li',
            { class: 'select-ability' },
            abilityIcon(character.id, ability, 'base', 'select-ability__icon'),
            h(
              'div',
              { class: 'select-ability__body' },
              h(
                'div',
                { class: 'select-ability__head' },
                h('h4', { class: 'select-ability__name' }, ability.name),
                h(
                  'span',
                  { class: 'select-ability__chips' },
                  h(
                    'span',
                    { class: 'chip-stat chip-stat--cost', title: ability.cost > 0 ? `Custa ${ability.cost} de ${resource}` : 'Sem custo' },
                    svg(ICONS.drop),
                    h('span', { class: 'visually-hidden' }, 'Custo '),
                    String(ability.cost),
                  ),
                  h(
                    'span',
                    { class: 'chip-stat chip-stat--cooldown', title: `Recarga de ${plural(ability.cooldown, 'turno', 'turnos')}` },
                    svg(ICONS.hourglass),
                    h('span', { class: 'visually-hidden' }, 'Recarga '),
                    String(ability.cooldown),
                  ),
                ),
              ),
              h('p', { class: 'select-ability__text' }, ability.description),
            ),
          ),
        ),
      ),
    );
  }

  private renderRandom(): void {
    this.artPanel.replaceChildren(h('div', { class: 'select__random-art' }, svg(ICONS.dice)));
    this.info.replaceChildren(
      h(
        'header',
        { class: 'select__identity' },
        h('h2', { class: 'select__name' }, 'Aleatório'),
        h('p', { class: 'select__role' }, 'Adversário surpresa'),
      ),
      h('p', { class: 'select__text' }, `Um dos ${CHARACTER_IDS.length} lutadores será sorteado quando a luta começar.`),
      h('p', { class: 'select__playstyle' }, 'Escolha um retrato para conhecer o adversário antes da luta.'),
    );
    this.kit.replaceChildren(
      h('h3', { class: 'select__section select__kit-title' }, svg(ICONS.ability), 'Habilidades'),
      h('p', { class: 'select__kit-empty' }, 'As habilidades aparecem quando o adversário for revelado.'),
    );
  }

  private progressBlock(level: number, xp: number): HTMLElement {
    const needed = xpToNextLevel(level);
    const fill = h('div', { class: 'meter__fill' });
    fill.style.width = needed > 0 ? `${(xp / needed) * 100}%` : '100%';
    return h(
      'div',
      { class: 'details__progress select__progress' },
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

  /** As artes grandes já carregadas: trocar de personagem não pisca. */
  private preloadArt(): void {
    for (const id of CHARACTER_IDS) {
      const image = new Image();
      image.decoding = 'async';
      image.src = CHARACTER_ART[id].full;
    }
  }

  /* Opções ---------------------------------------------------------------------- */

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

  /**
   * Escolha do cenário (só no passo do adversário): o mesmo grupo de opções de antes, agora
   * com uma miniatura de cada mapa. O cenário escolhido também aparece ao fundo da tela.
   */
  private stageControl(): HTMLElement {
    const group = h('div', { class: 'stage-picker', role: 'radiogroup', 'aria-label': 'Cenário' });
    for (const stage of STAGE_IDS) {
      const input = h('input', { type: 'radio', name: 'select-stage', value: stage, checked: this.stage === stage });
      input.addEventListener('change', () => {
        this.stage = stage;
        this.game.audio.play('select');
        this.showScenery();
      });
      group.append(
        h(
          'label',
          { class: 'stage-picker__option', title: STAGES[stage].name },
          input,
          h('img', { class: 'stage-picker__thumb', src: STAGES[stage].image, alt: '', decoding: 'async', loading: 'lazy' }),
          h('span', { class: 'stage-picker__name' }, STAGES[stage].name),
        ),
      );
    }
    return h('div', { class: 'select__stage' }, h('span', { class: 'page__aside-label' }, 'Cenário'), group);
  }

  private showScenery(): void {
    this.scenery.style.backgroundImage = `url("${STAGES[this.stage].image}")`;
    this.scenery.dataset.stage = this.stage;
  }

  /* Navegação ---------------------------------------------------------------------- */

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
      this.roster.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
      return;
    }
    this.game.showMenu();
  }
}
