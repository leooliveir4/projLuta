import { CHARACTER_IDS, createCharacter } from '../../core/roster.ts';
import type { Game } from '../../game/Game.ts';
import { xpToNextLevel } from '../../progression/Progression.ts';
import { CHARACTER_ART } from '../art.ts';
import { formatNumber, h, svg } from '../dom.ts';
import { ICONS } from '../icons.ts';
import { Screen } from './Screen.ts';

export class StatsScreen extends Screen {
  constructor(game: Game) {
    super('stats', 'Estatísticas');
    const stats = game.progression.data.stats;
    const winRate = stats.battles > 0 ? Math.round((stats.wins / stats.battles) * 100) : 0;

    const back = h('button', { class: 'icon-button', type: 'button', 'data-autofocus': true }, svg(ICONS.back), 'Voltar');
    back.addEventListener('click', () => game.showMenu());

    const totals: [string, string][] = [
      ['Batalhas', String(stats.battles)],
      ['Vitórias', String(stats.wins)],
      ['Derrotas', String(stats.losses)],
      ['Aproveitamento', `${winRate}%`],
      ['Melhor sequência', String(stats.bestStreak)],
      ['Desafios concluídos', String(stats.challengesCompleted)],
      ['Dano total', formatNumber(stats.damageDealt)],
      ['Acertos críticos', String(stats.criticalHits)],
    ];

    const rows = CHARACTER_IDS.map((id) => {
      const progress = game.progression.characterProgress(id);
      const needed = xpToNextLevel(progress.level);
      return h(
        'tr',
        {},
        h('th', { scope: 'row' }, h('span', { class: 'stats-table__who' }, h('img', { src: CHARACTER_ART[id].portrait, alt: '' }), createCharacter(id).name)),
        h('td', {}, String(progress.level)),
        h('td', {}, needed > 0 ? `${progress.xp} / ${needed}` : 'Máx.'),
        h('td', {}, String(progress.wins)),
        h('td', {}, String(progress.losses)),
      );
    });

    this.element.append(
      h(
        'div',
        { class: 'page' },
        h('header', { class: 'page__header' }, back, h('div', { class: 'page__heading' }, h('h1', { class: 'screen-title' }, 'Estatísticas'))),
        stats.battles === 0
          ? h('p', { class: 'empty-state plate' }, 'Nenhuma batalha registrada ainda. Comece um duelo ou um desafio pelo menu.')
          : null,
        h('dl', { class: 'totals' }, ...totals.map(([label, value]) => h('div', { class: 'totals__item plate' }, h('dt', {}, label), h('dd', {}, value)))),
        h(
          'section',
          { class: 'plate stats-table-wrap' },
          h(
            'table',
            { class: 'stats-table' },
            h('caption', {}, 'Progresso por lutador'),
            h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Lutador'), h('th', { scope: 'col' }, 'Nível'), h('th', { scope: 'col' }, 'XP'), h('th', { scope: 'col' }, 'Vitórias'), h('th', { scope: 'col' }, 'Derrotas'))),
            h('tbody', {}, ...rows),
          ),
        ),
      ),
    );
  }
}
