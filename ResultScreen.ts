import { createCharacter } from '../../core/roster.ts';
import type { BattleOutcome } from '../../game/BattleController.ts';
import type { Game } from '../../game/Game.ts';
import { CHALLENGE_LENGTH, type ProgressUpdate } from '../../progression/Progression.ts';
import { applyFrame, CHARACTER_ART, needsFlip } from '../art.ts';
import { formatNumber, h, svg } from '../dom.ts';
import { ICONS } from '../icons.ts';
import { Screen } from './Screen.ts';

/** Resultado da batalha: resumo, experiência obtida e próximos passos. */
export class ResultScreen extends Screen {
  private readonly xpFill: HTMLElement;
  private readonly targetWidth: string;

  constructor(game: Game, outcome: BattleOutcome, update: ProgressUpdate) {
    super('result', outcome.won ? 'Vitória' : 'Derrota');
    const { config, won } = outcome;
    const player = createCharacter(config.playerId, update.experience.levelAfter);
    const enemy = createCharacter(config.enemyId, config.enemyLevel);
    const winner = won ? player : enemy;
    const xp = update.experience;

    let subtitle = won ? `${player.name} derrotou ${enemy.name}.` : `${enemy.name} venceu desta vez.`;
    if (update.challengeCompleted) subtitle = `Desafio concluído com ${player.name}!`;
    else if (update.challengeStageCleared !== null) {
      subtitle = `Etapa ${update.challengeStageCleared + 1} de ${CHALLENGE_LENGTH} vencida.`;
    } else if (config.mode === 'challenge') {
      subtitle = `A etapa ${(config.challengeStage ?? 0) + 1} continua esperando por você.`;
    }

    const rows: [string, string][] = [
      ['Turnos', String(outcome.turns)],
      ['Dano causado', formatNumber(outcome.player.damageDealt)],
      ['Dano recebido', formatNumber(outcome.player.damageTaken)],
      ['Maior golpe', formatNumber(outcome.player.biggestHit)],
      ['Acertos críticos', String(outcome.player.criticalHits)],
      ['Vida recuperada', formatNumber(outcome.player.healing)],
      ['Habilidades usadas', String(outcome.player.abilitiesUsed)],
      ['Itens usados', String(outcome.player.itemsUsed)],
    ];

    this.xpFill = h('div', { class: 'meter__fill' });
    const startRatio = xp.levelAfter > xp.levelBefore ? 0 : Math.max(0, (xp.xpAfter - xp.gained) / (xp.xpToNext || 1));
    this.xpFill.style.width = `${startRatio * 100}%`;
    this.targetWidth = xp.xpToNext > 0 ? `${(xp.xpAfter / xp.xpToNext) * 100}%` : '100%';

    const buttons: HTMLElement[] = [];
    const primary = (label: string, icon: keyof typeof ICONS, action: () => void) => {
      const button = h('button', { class: 'btn btn--primary', type: 'button', 'data-autofocus': buttons.length === 0 }, svg(ICONS[icon]), label);
      button.addEventListener('click', action);
      buttons.push(button);
    };
    const secondary = (label: string, icon: keyof typeof ICONS, action: () => void) => {
      const button = h('button', { class: 'btn btn--quiet', type: 'button' }, svg(ICONS[icon]), label);
      button.addEventListener('click', action);
      buttons.push(button);
    };

    if (config.mode === 'challenge') {
      if (update.challengeCompleted) {
        primary('Novo desafio', 'crown', () => game.showSelect('challenge'));
      } else if (won) {
        primary('Próximo adversário', 'play', () => game.showChallenge());
      } else {
        primary('Revanche', 'replay', () => game.rematch());
        secondary('Ver desafio', 'crown', () => game.showChallenge());
      }
    } else {
      primary('Revanche', 'replay', () => game.rematch());
      secondary('Trocar lutadores', 'dice', () => game.showSelect('duel'));
    }
    secondary('Menu', 'home', () => game.showMenu());

    // O vencedor olha para o painel, à direita, com o corpo centralizado na coluna.
    const winnerArt = CHARACTER_ART[winner.id];
    const flipped = needsFlip(winnerArt, 'right');
    const art = h('img', {
      class: `result__art${flipped ? ' is-flipped' : ''}${winnerArt.frame.mask ? ' has-mask' : ''}`,
      src: winnerArt.full,
      alt: '',
      decoding: 'async',
    });
    applyFrame(art, winnerArt.frame, flipped);

    this.element.append(
      h(
        'div',
        { class: `result result--${won ? 'victory' : 'defeat'}` },
        art,
        h(
          'section',
          { class: 'result__panel plate plate--gold' },
          h('h1', { class: 'result__title' }, won ? 'Vitória' : 'Derrota'),
          h('p', { class: 'result__subtitle' }, subtitle),
          h(
            'div',
            { class: 'result__xp' },
            h('span', { class: 'result__xp-gain' }, xp.gained > 0 ? `+${xp.gained} XP` : 'Sem experiência'),
            h('span', { class: 'result__xp-level' }, `${player.name}, nível ${xp.levelAfter}`),
            h('div', { class: 'meter meter--xp', role: 'meter', 'aria-label': 'Experiência', 'aria-valuenow': xp.xpAfter, 'aria-valuemax': xp.xpToNext || xp.xpAfter }, this.xpFill),
            h('span', { class: 'result__xp-next' }, xp.xpToNext > 0 ? `${xp.xpAfter} / ${xp.xpToNext} XP` : 'Nível máximo'),
            xp.levelAfter > xp.levelBefore
              ? h('p', { class: 'result__levelup' }, `Subiu para o nível ${xp.levelAfter}! Vida, ataque e defesa aumentaram.`)
              : null,
            config.mode === 'duel'
              ? h('p', { class: 'result__note' }, 'Níveis valem apenas no modo desafio; o duelo é sempre equilibrado.')
              : null,
          ),
          h(
            'dl',
            { class: 'summary' },
            ...rows.map(([label, value]) => h('div', { class: 'summary__row' }, h('dt', {}, label), h('dd', {}, value))),
          ),
          h('div', { class: 'result__actions' }, ...buttons),
        ),
      ),
    );
  }

  protected override onMount(): void {
    super.onMount();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        this.xpFill.style.width = this.targetWidth;
      }),
    );
  }
}
