import { DIFFICULTY_SETTINGS } from '../../core/BattleAI.ts';
import { createCharacter, mirrorName } from '../../core/roster.ts';
import type { Game } from '../../game/Game.ts';
import { CHALLENGE_LENGTH, challengeEnemyLevel, xpToNextLevel } from '../../progression/Progression.ts';
import { CHARACTER_ART } from '../art.ts';
import { h, svg } from '../dom.ts';
import { ICONS } from '../icons.ts';
import { Screen } from './Screen.ts';

/** Painel do modo desafio: progresso nas etapas e próximo adversário. */
export class ChallengeScreen extends Screen {
  constructor(game: Game) {
    super('challenge', 'Modo desafio');
    const run = game.progression.activeChallenge;
    if (!run) return;

    const progress = game.progression.characterProgress(run.characterId);
    const player = createCharacter(run.characterId, progress.level);
    const needed = xpToNextLevel(progress.level);
    const xpFill = h('div', { class: 'meter__fill' });
    xpFill.style.width = needed > 0 ? `${(progress.xp / needed) * 100}%` : '100%';

    const stages = run.opponents.map((id, index) => {
      const level = challengeEnemyLevel(progress.level, index);
      const opponent = createCharacter(id, level);
      const state = index < run.stage ? 'cleared' : index === run.stage ? 'current' : 'locked';
      const status = state === 'cleared' ? 'Vencido' : state === 'current' ? 'Próximo' : 'Bloqueado';
      const isMirror = index === run.opponents.length - 1;
      return h(
        'li',
        { class: `ladder__stage ladder__stage--${state}`, 'aria-current': state === 'current' ? 'step' : undefined },
        h('span', { class: 'ladder__number' }, index + 1),
        h(
          'div',
          { class: 'ladder__portrait' },
          h('img', { src: CHARACTER_ART[id].portrait, alt: '' }),
          state === 'cleared' ? h('span', { class: 'ladder__mark' }, svg(ICONS.check)) : null,
          state === 'locked' ? h('span', { class: 'ladder__mark' }, svg(ICONS.lock)) : null,
        ),
        h('strong', { class: 'ladder__name' }, isMirror ? mirrorName(opponent.name) : opponent.name),
        h('span', { class: 'ladder__meta' }, `Nv. ${level}, ${status.toLowerCase()}`),
      );
    });

    const current = createCharacter(run.opponents[run.stage], challengeEnemyLevel(progress.level, run.stage));

    const fight = h('button', { class: 'btn btn--primary', type: 'button', 'data-autofocus': true }, svg(ICONS.attack), `Lutar contra ${current.name}`);
    fight.addEventListener('click', () => game.startChallengeBattle());

    const abandon = h('button', { class: 'btn btn--quiet', type: 'button' }, svg(ICONS.flag), 'Abandonar desafio');
    let confirming = false;
    abandon.addEventListener('click', () => {
      if (!confirming) {
        confirming = true;
        abandon.lastChild!.textContent = 'Confirmar abandono';
        return;
      }
      game.abandonChallenge();
    });

    const back = h('button', { class: 'icon-button', type: 'button' }, svg(ICONS.home), 'Menu');
    back.addEventListener('click', () => game.showMenu());

    this.element.append(
      h(
        'div',
        { class: 'page' },
        h(
          'header',
          { class: 'page__header' },
          back,
          h(
            'div',
            { class: 'page__heading' },
            h('h1', { class: 'screen-title' }, 'Modo desafio'),
            h('p', { class: 'screen-hint' }, `Etapa ${run.stage + 1} de ${CHALLENGE_LENGTH}. Dificuldade ${DIFFICULTY_SETTINGS[game.settings.value.difficulty].label.toLowerCase()}.`),
          ),
        ),
        h(
          'section',
          { class: 'challenge__player plate plate--gold' },
          h('img', { class: 'challenge__portrait', src: CHARACTER_ART[player.id].portrait, alt: '' }),
          h(
            'div',
            { class: 'challenge__info' },
            h('h2', { class: 'challenge__name' }, player.name),
            h('p', { class: 'challenge__level' }, `Nível ${progress.level}`),
            h('div', { class: 'meter meter--xp', role: 'meter', 'aria-label': 'Experiência', 'aria-valuenow': progress.xp, 'aria-valuemax': needed || progress.xp }, xpFill),
            h('p', { class: 'challenge__xp' }, needed > 0 ? `${progress.xp} / ${needed} XP para o próximo nível` : 'Nível máximo alcançado'),
          ),
        ),
        h('ol', { class: 'ladder', 'aria-label': 'Etapas do desafio' }, ...stages),
        h(
          'p',
          { class: 'challenge__rules' },
          'Vida e itens são restaurados a cada luta. Se perder, você pode tentar a mesma etapa de novo. Concluir o desafio rende 150 XP extras.',
        ),
        h('footer', { class: 'page__footer' }, abandon, fight),
      ),
    );
  }
}
