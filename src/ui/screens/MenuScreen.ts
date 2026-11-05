import { createCharacter } from '../../core/roster.ts';
import type { Game } from '../../game/Game.ts';
import { CHALLENGE_LENGTH } from '../../progression/Progression.ts';
import { applyFrame, CHARACTER_ART, formArt, needsFlip, type FormArt } from '../art.ts';
import { h, svg } from '../dom.ts';
import { ICONS, type IconName } from '../icons.ts';
import { Screen } from './Screen.ts';

export class MenuScreen extends Screen {
  private readonly game: Game;
  private readonly nav: HTMLElement;

  constructor(game: Game) {
    super('menu', 'Menu principal');
    this.game = game;
    this.nav = h('nav', { class: 'menu__nav', 'aria-label': 'Menu principal' });
    const notice = game.saveNotice;

    this.element.append(
      this.sideArt(CHARACTER_ART.lyra, 'left'),
      this.sideArt(formArt('nyxara', 'eclipse'), 'right'),
      h(
        'div',
        { class: 'menu__content' },
        h(
          'header',
          { class: 'menu__brand' },
          h('h1', { class: 'game-title' }, h('span', { class: 'game-title__small' }, 'Jogo de'), h('span', {}, 'Luta')),
          h('p', { class: 'game-subtitle' }, 'RPG de combate por turnos'),
        ),
        notice ? h('p', { class: 'menu__notice', role: 'status' }, notice) : null,
        this.nav,
        h('p', { class: 'menu__footer' }, 'Evoluído a partir de um projeto do curso de JavaScript da B7Web'),
      ),
    );
    this.showMain();
  }

  /** Arte lateral do menu, sempre olhando para o centro da tela. */
  private sideArt(art: FormArt, side: 'left' | 'right'): HTMLElement {
    const flipped = needsFlip(art, side === 'left' ? 'right' : 'left');
    const image = h('img', { class: `menu__art menu__art--${side}${flipped ? ' is-flipped' : ''}`, src: art.full, alt: '', decoding: 'async' });
    applyFrame(image, art.frame, flipped);
    return image;
  }

  private showMain(): void {
    const run = this.game.progression.activeChallenge;
    const buttons: HTMLElement[] = [];
    if (run) {
      const name = createCharacter(run.characterId).name;
      buttons.push(
        this.button('play', 'Continuar desafio', `${name}, etapa ${run.stage + 1} de ${CHALLENGE_LENGTH}`, () =>
          this.game.showChallenge(),
        true),
      );
    }
    buttons.push(
      this.button('attack', 'Novo jogo', null, () => this.showModes(), !run),
      this.button('chart', 'Estatísticas', null, () => this.game.showStats()),
      this.button('gear', 'Opções', null, () => this.game.showOptions()),
      this.button('book', 'Créditos', null, () => this.game.showCredits()),
    );
    this.nav.replaceChildren(...buttons);
    if (this.element.isConnected) this.focusFirst();
  }

  private showModes(): void {
    this.game.audio.play('select');
    const run = this.game.progression.activeChallenge;
    this.nav.replaceChildren(
      this.button('attack', 'Duelo', 'Luta avulsa. Os dois lutadores no nível 1, sem bônus de progressão.', () =>
        this.game.showSelect('duel'),
      true),
      this.button(
        'crown',
        'Desafio',
        run
          ? 'Quatro adversários seguidos com níveis e experiência. Substitui o desafio em andamento.'
          : 'Quatro adversários seguidos, com níveis e experiência.',
        () => this.game.showSelect('challenge'),
      ),
      this.button('back', 'Voltar', null, () => this.showMain()),
    );
    this.focusFirst();
  }

  private button(icon: IconName, label: string, detail: string | null, onClick: () => void, autofocus = false): HTMLElement {
    const button = h(
      'button',
      { class: `menu-button${detail ? ' menu-button--detailed' : ''}`, type: 'button', 'data-autofocus': autofocus },
      svg(ICONS[icon]),
      h('span', { class: 'menu-button__text' }, h('span', { class: 'menu-button__label' }, label), detail ? h('span', { class: 'menu-button__detail' }, detail) : null),
    );
    button.addEventListener('click', () => {
      this.game.audio.unlock();
      onClick();
    });
    return button;
  }

  private focusFirst(): void {
    this.nav.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  }
}
