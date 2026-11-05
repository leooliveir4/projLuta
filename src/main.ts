import './styles/fonts.css';
import './styles/base.css';
import './styles/screens.css';
import './styles/battle.css';
import { Game } from './game/Game.ts';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Elemento #app não encontrado.');

new Game(root).start();
