import { DIFFICULTY_SETTINGS } from '../../core/BattleAI.ts';
import type { Difficulty } from '../../core/types.ts';
import type { Game } from '../../game/Game.ts';
import { h, prefersReducedMotion, svg } from '../dom.ts';
import { ICONS } from '../icons.ts';
import { Screen } from './Screen.ts';

const DIFFICULTY_TEXT: Record<Difficulty, string> = {
  easy: 'O adversário erra com frequência e quase não usa itens.',
  normal: 'Decisões sensatas, com alguns deslizes.',
  hard: 'Calcula finalizações, lê ameaças e evita a sua Postura de Revide.',
};

export class OptionsScreen extends Screen {
  constructor(game: Game, onBack: () => void) {
    super('options', 'Opções');
    const settings = game.settings;
    const values = settings.value;

    const volume = h('input', {
      type: 'range',
      id: 'opt-volume',
      min: 0,
      max: 100,
      step: 5,
      value: Math.round(values.volume * 100),
      'aria-describedby': 'opt-volume-value',
    });
    const volumeValue = h('output', { id: 'opt-volume-value', class: 'option__value', for: 'opt-volume' }, `${Math.round(values.volume * 100)}%`);
    volume.addEventListener('input', () => {
      volumeValue.textContent = `${volume.value}%`;
      settings.update({ volume: Number(volume.value) / 100 });
    });
    volume.addEventListener('change', () => game.audio.play('select'));

    const sound = h('input', { type: 'checkbox', id: 'opt-sound', checked: values.soundEnabled });
    sound.addEventListener('change', () => {
      settings.update({ soundEnabled: sound.checked });
      game.audio.play('select');
    });

    const motion = h('input', { type: 'checkbox', id: 'opt-motion', checked: values.animationsEnabled });
    motion.addEventListener('change', () => settings.update({ animationsEnabled: motion.checked }));

    const difficultyHint = h('p', { class: 'option__hint' }, DIFFICULTY_TEXT[values.difficulty]);
    const difficulty = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Dificuldade' });
    for (const level of ['easy', 'normal', 'hard'] as Difficulty[]) {
      const input = h('input', { type: 'radio', name: 'opt-difficulty', value: level, checked: values.difficulty === level });
      input.addEventListener('change', () => {
        settings.update({ difficulty: level });
        difficultyHint.textContent = DIFFICULTY_TEXT[level];
      });
      difficulty.append(h('label', {}, input, h('span', {}, DIFFICULTY_SETTINGS[level].label)));
    }

    const reset = h('button', { class: 'btn btn--danger', type: 'button' }, 'Apagar progresso');
    const resetHint = h('p', { class: 'option__hint', role: 'status' }, 'Remove níveis, estatísticas e o desafio em andamento.');
    let confirming = false;
    reset.addEventListener('click', () => {
      if (!confirming) {
        confirming = true;
        reset.textContent = 'Confirmar exclusão';
        resetHint.textContent = 'Clique de novo para apagar. Esta ação não pode ser desfeita.';
        return;
      }
      game.resetProgress();
      confirming = false;
      reset.textContent = 'Apagar progresso';
      resetHint.textContent = 'Progresso apagado.';
    });

    const back = h('button', { class: 'icon-button', type: 'button', 'data-autofocus': true }, svg(ICONS.back), 'Voltar');
    back.addEventListener('click', onBack);

    const systemMotion = prefersReducedMotion()
      ? h('p', { class: 'option__hint' }, 'Seu sistema pede movimento reduzido, então as animações ficam desligadas mesmo com esta opção ativa.')
      : h('p', { class: 'option__hint' }, 'Golpes, projéteis e transições da arena.');

    this.element.append(
      h(
        'div',
        { class: 'page page--narrow' },
        h('header', { class: 'page__header' }, back, h('div', { class: 'page__heading' }, h('h1', { class: 'screen-title' }, 'Opções'))),
        h(
          'section',
          { class: 'options plate' },
          h(
            'div',
            { class: 'option' },
            h('label', { class: 'option__label', for: 'opt-volume' }, 'Volume'),
            h('div', { class: 'option__control option__control--range' }, volume, volumeValue),
          ),
          h(
            'div',
            { class: 'option option--inline' },
            h('label', { class: 'option__label', for: 'opt-sound' }, 'Efeitos sonoros'),
            h('span', { class: 'switch' }, sound, h('span')),
          ),
          h(
            'div',
            { class: 'option option--inline' },
            h('div', {}, h('label', { class: 'option__label', for: 'opt-motion' }, 'Animações'), systemMotion),
            h('span', { class: 'switch' }, motion, h('span')),
          ),
          h(
            'div',
            { class: 'option' },
            h('span', { class: 'option__label', id: 'opt-difficulty-label' }, 'Dificuldade'),
            difficulty,
            difficultyHint,
          ),
          h(
            'div',
            { class: 'option' },
            h('span', { class: 'option__label' }, 'Progresso'),
            game.storageAvailable
              ? h('div', { class: 'option__control' }, reset)
              : h('p', { class: 'option__hint' }, 'O navegador bloqueou o armazenamento local; o progresso não será salvo.'),
            game.storageAvailable ? resetHint : null,
          ),
        ),
      ),
    );
  }
}
