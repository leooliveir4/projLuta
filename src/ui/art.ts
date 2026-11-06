import dravenorFull from '../assets/images/characters/dravenor.webp';
import kaelFull from '../assets/images/characters/kael.webp';
import lyraFull from '../assets/images/characters/lyra.webp';
import vaelithFull from '../assets/images/characters/nyxara-eclipse.webp';
import nyxaraFull from '../assets/images/characters/nyxara.webp';
import vexraFull from '../assets/images/characters/vexra.webp';
import vorathFull from '../assets/images/characters/vorath.webp';
import dravenorPortrait from '../assets/images/portraits/dravenor.webp';
import kaelPortrait from '../assets/images/portraits/kael.webp';
import lyraPortrait from '../assets/images/portraits/lyra.webp';
import vaelithPortrait from '../assets/images/portraits/nyxara-eclipse.webp';
import nyxaraPortrait from '../assets/images/portraits/nyxara.webp';
import vexraPortrait from '../assets/images/portraits/vexra.webp';
import vorathPortrait from '../assets/images/portraits/vorath.webp';
import vexraTurret from '../assets/images/effects/vexra-turret.webp';
import arcaneArena from '../assets/images/arena-arcana.svg';
import ring from '../assets/images/ringue.webp';
import abyssalDimension from '../assets/images/stages/dimensao-abissal.webp';
import ancientRuins from '../assets/images/stages/ruinas-antigas.webp';
import eclipseTemple from '../assets/images/stages/templo-eclipse.webp';
import type { CharacterId } from '../core/types.ts';

export type StageId = 'arcane' | 'ring' | 'ruinas-antigas' | 'templo-eclipse' | 'dimensao-abissal';

export interface StageArt {
  name: string;
  image: string;
}

/**
 * Cenários das batalhas. A Arena Arcana é original; o ringue vem do projeto do curso; Ruínas
 * Antigas, Templo do Eclipse e Dimensão Abissal são artes finais (1672 × 941) usadas sem
 * alteração. O enquadramento e o contraste de cada um ficam em battle.css
 * (`.battle__stage--<id>`).
 */
export const STAGES: Record<StageId, StageArt> = {
  arcane: { name: 'Arena Arcana', image: arcaneArena },
  ring: { name: 'Ringue', image: ring },
  'ruinas-antigas': { name: 'Ruínas Antigas', image: ancientRuins },
  'templo-eclipse': { name: 'Templo do Eclipse', image: eclipseTemple },
  'dimensao-abissal': { name: 'Dimensão Abissal', image: abyssalDimension },
};

export const STAGE_IDS: readonly StageId[] = ['arcane', 'ring', 'ruinas-antigas', 'templo-eclipse', 'dimensao-abissal'];

/**
 * Cenário de cada etapa do desafio. As duas primeiras continuam como antes (Arena Arcana e
 * Ringue); a terceira passa às Ruínas Antigas, e o duelo final, contra a própria sombra,
 * acontece na Dimensão Abissal.
 */
export const CHALLENGE_STAGES: readonly StageId[] = ['arcane', 'ring', 'ruinas-antigas', 'dimensao-abissal'];

/** Cenário de uma etapa do desafio (se houver mais etapas que cenários, a lista recomeça). */
export function challengeStage(index: number): StageId {
  return CHALLENGE_STAGES[((index % CHALLENGE_STAGES.length) + CHALLENGE_STAGES.length) % CHALLENGE_STAGES.length];
}

export const MENU_BACKDROP = arcaneArena;

/**
 * Enquadramento de uma arte de corpo inteiro. Os números vêm da própria imagem
 * (medidos no canal de transparência), então valem para qualquer tela; o CSS só
 * aplica escala e deslocamento, sem recortar nem redimensionar os arquivos.
 */
export interface ArtFrame {
  /** Largura ÷ altura do arquivo original. Permite reservar o espaço antes de a imagem carregar. */
  aspect: number;
  /** Centro do corpo (entre os pés) na imagem original: 0 = borda esquerda, 1 = borda direita. */
  anchorX: number;
  /** Altura do peito na imagem original (0 = topo), usada para mirar efeitos e textos. */
  focusY: number;
  /** Altura da arte na arena, em fração da altura disponível. */
  height: number;
  /** Largura máxima na arena, em fração da largura da arena (protege telas estreitas). */
  maxWidth?: number;
  /**
   * Máscara para suavizar bordas com transparência difusa (auras cortadas pelo limite
   * do arquivo). As coordenadas são as da imagem original, antes de espelhar.
   */
  mask?: string;
  /** Vitrine da seleção: altura (fração do painel) e posição do corpo (fração da largura). */
  showcase?: { height?: number; x?: number };
  /** Ponta da arma ou foco mágico na imagem original [x, y], de onde saem os projéteis. */
  muzzle?: [number, number];
}

/**
 * Poses de combate. Sem arquivo próprio, cada pose é feita por transformação da arte
 * parada (inclinação, recuo, salto). Com um arquivo em `poses`, a arte é trocada
 * durante a pose; o arquivo precisa ter o mesmo enquadramento da arte parada.
 */
export type PoseName = 'windup' | 'strike' | 'cast' | 'hurt' | 'guard' | 'victory' | 'defeat';
export const POSE_NAMES: readonly PoseName[] = ['windup', 'strike', 'cast', 'hurt', 'guard', 'victory', 'defeat'];

export interface FormArt {
  full: string;
  portrait: string;
  /** Para onde o personagem olha ou aponta a arma na imagem original. */
  facing: 'left' | 'right';
  frame: ArtFrame;
  /** Arquivos opcionais de pose (mesmo tamanho e ponto de apoio da arte parada). */
  poses?: Partial<Record<PoseName, string>>;
}

export interface CharacterArt extends FormArt {
  /** Cores dos efeitos visuais das habilidades. */
  primary: string;
  secondary: string;
  /** Artes de formas alternativas, indexadas pelo `formId` do personagem. */
  forms?: Record<string, FormArt>;
}

/**
 * Artes definitivas estáticas dos personagens (WebP transparente). Para trocar a arte, basta
 * substituir os arquivos e revisar o enquadramento; a lógica do jogo não depende delas.
 * `facing` segue a arma e o corpo: Vexra aponta o canhão e Kael a espada para a esquerda,
 * então os dois são espelhados quando ocupam o lado do jogador.
 */
export const CHARACTER_ART: Record<CharacterId, CharacterArt> = {
  lyra: {
    full: lyraFull,
    portrait: lyraPortrait,
    facing: 'right',
    frame: { aspect: 0.75, anchorX: 0.5, focusY: 0.36, height: 0.88, muzzle: [0.78, 0.11] },
    primary: '#b8e4ff',
    secondary: '#ffe7a0',
  },
  vexra: {
    full: vexraFull,
    portrait: vexraPortrait,
    facing: 'left',
    frame: { aspect: 0.914, anchorX: 0.66, focusY: 0.34, height: 0.86, maxWidth: 0.5, showcase: { height: 0.8, x: 0.24 }, muzzle: [0.06, 0.27] },
    primary: '#ffb347',
    secondary: '#ff6a1f',
  },
  dravenor: {
    full: dravenorFull,
    portrait: dravenorPortrait,
    facing: 'right',
    frame: { aspect: 0.853, anchorX: 0.48, focusY: 0.4, height: 0.93, maxWidth: 0.48, showcase: { height: 0.74 } },
    primary: '#ff8a2b',
    secondary: '#ffd27a',
  },
  kael: {
    full: kaelFull,
    portrait: kaelPortrait,
    facing: 'left',
    frame: { aspect: 0.914, anchorX: 0.52, focusY: 0.34, height: 0.88, maxWidth: 0.5, showcase: { height: 0.78, x: 0.24 } },
    primary: '#9fe8ff',
    secondary: '#3aa0ff',
  },
  nyxara: {
    full: nyxaraFull,
    portrait: nyxaraPortrait,
    facing: 'right',
    frame: { aspect: 0.941, anchorX: 0.56, focusY: 0.33, height: 0.88, maxWidth: 0.5, showcase: { height: 0.66, x: 0.22 } },
    primary: '#ff2e56',
    secondary: '#8a0f2a',
    forms: {
      eclipse: {
        full: vaelithFull,
        portrait: vaelithPortrait,
        facing: 'right',
        frame: { aspect: 0.658, anchorX: 0.52, focusY: 0.34, height: 0.92 },
      },
    },
  },
  vorath: {
    full: vorathFull,
    portrait: vorathPortrait,
    facing: 'right',
    frame: { aspect: 0.75, anchorX: 0.48, focusY: 0.42, height: 0.99, maxWidth: 0.5 },
    primary: '#c79bff',
    secondary: '#7a4ad0',
  },
};

/** Torre Automática da Vexra (arte própria, apontando para a direita). */
export const TURRET_ART = vexraTurret;
/** Boca do canhão da torre na imagem [x, y], de onde saem os tiros. */
export const TURRET_MUZZLE: readonly [number, number] = [0.92, 0.26];

/** Largura máxima padrão de uma arte na arena, em fração da largura da arena. */
export const DEFAULT_MAX_WIDTH = 0.46;

/**
 * Deslocamento horizontal, em % da largura da própria imagem, que centraliza o corpo
 * (e não o retângulo do arquivo) no ponto de apoio. Considera o espelhamento.
 */
export function anchorShift(frame: ArtFrame, flipped: boolean): string {
  const anchor = flipped ? 1 - frame.anchorX : frame.anchorX;
  return `${((0.5 - anchor) * 100).toFixed(2)}%`;
}

/** Variáveis CSS do enquadramento, aplicadas no elemento que contém a arte. */
export function frameStyle(frame: ArtFrame, flipped: boolean): Record<string, string> {
  return {
    '--art-aspect': String(frame.aspect),
    '--art-h': String(frame.height),
    '--art-maxw': String(frame.maxWidth ?? DEFAULT_MAX_WIDTH),
    '--art-shift': anchorShift(frame, flipped),
    '--art-anchor': String(flipped ? 1 - frame.anchorX : frame.anchorX),
    '--art-focus': String(frame.focusY),
    '--art-mask': frame.mask ?? 'none',
    '--show-h': String(frame.showcase?.height ?? 0.9),
    '--show-x': String(frame.showcase?.x ?? 0.25),
  };
}

/** Aplica as variáveis de enquadramento num elemento. */
export function applyFrame(element: HTMLElement, frame: ArtFrame, flipped: boolean): void {
  for (const [name, value] of Object.entries(frameStyle(frame, flipped))) element.style.setProperty(name, value);
}

/** Espelha a arte quando ela olha para o lado oposto ao desejado. */
export function needsFlip(art: FormArt, lookTo: 'left' | 'right'): boolean {
  return art.facing !== lookTo;
}

/** Arte da forma atual do personagem (a forma base quando não há variação). */
export function formArt(id: CharacterId, formId = 'base'): FormArt {
  const art = CHARACTER_ART[id];
  return art.forms?.[formId] ?? art;
}
