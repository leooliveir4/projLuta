import type { Game } from '../../game/Game.ts';
import { h, svg } from '../dom.ts';
import { ICONS } from '../icons.ts';
import { Screen } from './Screen.ts';

export class CreditsScreen extends Screen {
  constructor(game: Game) {
    super('credits', 'Créditos');
    const back = h('button', { class: 'icon-button', type: 'button', 'data-autofocus': true }, svg(ICONS.back), 'Voltar');
    back.addEventListener('click', () => game.showMenu());

    const section = (title: string, ...paragraphs: (string | HTMLElement)[]) =>
      h('section', { class: 'credits__section' }, h('h2', { class: 'credits__title' }, title), ...paragraphs.map((p) => (typeof p === 'string' ? h('p', {}, p) : p)));

    this.element.append(
      h(
        'div',
        { class: 'page page--narrow' },
        h('header', { class: 'page__header' }, back, h('div', { class: 'page__heading' }, h('h1', { class: 'screen-title' }, 'Créditos'))),
        h(
          'article',
          { class: 'credits plate' },
          section(
            'Origem',
            'Este jogo nasceu como exercício de Programação Orientada a Objetos no curso de JavaScript da B7Web: quatro personagens, uma barra de vida e um botão de ataque.',
            'Depois foi reescrito em TypeScript e ampliado com turnos, habilidades, efeitos, inteligência artificial, progressão e uma nova interface. Na versão atual, os quatro lutadores do curso deram lugar a um elenco original de seis personagens.',
          ),
          section('Desenvolvimento', 'Leo, com base no projeto original do curso.'),
          section(
            'Personagens',
            'Lyra, Vexra, Dravenor, Kael, Nyxara (e Vaelith) e Vorath são personagens originais deste projeto. As artes atuais são ilustrações estáticas originais integradas em WebP; ainda não são sprites animados.',
          ),
          section(
            'Cenários e sons',
            'A Arena Arcana foi desenhada em SVG para este projeto. A imagem do ringue é de vectorpouch no Freepik e vem do projeto original, assim como os sons de golpe e de nocaute; os demais efeitos sonoros são sintetizados no próprio navegador.',
          ),
          section('Tecnologia', 'TypeScript, HTML e CSS, com Vite para desenvolvimento e build e Vitest para os testes. Nenhum framework de interface.'),
        ),
      ),
    );
  }
}
