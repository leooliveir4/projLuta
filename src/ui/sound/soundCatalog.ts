import type { CharacterId } from '../../core/types.ts';

/**
 * Catálogo sonoro: quais arquivos existem, onde fica o momento principal de cada um e qual
 * habilidade usa qual som. São só dados (sem DOM nem Web Audio), separados das regras do
 * combate, para poderem ser testados e ajustados sem mexer no motor.
 */

export type ClipId =
  | 'lyra-astral-orb'
  | 'lyra-supernova'
  | 'vexra-piercing-burst'
  | 'vexra-explosive-grenade'
  | 'vexra-auto-turret-shot'
  | 'dravenor-devastating-blow'
  | 'dravenor-earth-rupture'
  | 'kael-arcane-blade'
  | 'kael-dimensional-cut'
  | 'nyxara-shadow-blade'
  | 'nyxara-eclipse'
  | 'vaelith-shadow-blade'
  | 'vorath-abyss-impact'
  | 'vorath-void-rupture'
  | 'general-combat-impact'
  | 'knockout';

export interface ClipInfo {
  /** Duração do arquivo, em segundos (conferida nos testes). */
  duration: number;
  /**
   * Instante, em segundos dentro do arquivo, do acontecimento principal: o disparo, o golpe,
   * a explosão ou o clarão. É esse ponto que é alinhado com a animação.
   */
  hitAt: number;
  /** Ajuste fino de volume na reprodução (dB), além da normalização já feita no arquivo. */
  gainDb?: number;
}

/** Medições feitas nos arquivos (envelope e espectrograma); detalhes em docs/audio.md. */
export const CLIPS: Record<ClipId, ClipInfo> = {
  'lyra-astral-orb': { duration: 1.5, hitAt: 0.08 },
  'lyra-supernova': { duration: 2.5, hitAt: 0.9 },
  'vexra-piercing-burst': { duration: 1.6, hitAt: 0.01 },
  'vexra-explosive-grenade': { duration: 1.6, hitAt: 0.06 },
  'vexra-auto-turret-shot': { duration: 1.0, hitAt: 0.22 },
  'dravenor-devastating-blow': { duration: 1.2, hitAt: 0.27 },
  'dravenor-earth-rupture': { duration: 2.0, hitAt: 0.09 },
  'kael-arcane-blade': { duration: 1.1, hitAt: 0.13 },
  'kael-dimensional-cut': { duration: 2.0, hitAt: 0.33 },
  'nyxara-shadow-blade': { duration: 1.3, hitAt: 0.33 },
  'nyxara-eclipse': { duration: 2.6, hitAt: 0.62 },
  'vaelith-shadow-blade': { duration: 1.5, hitAt: 0.3 },
  'vorath-abyss-impact': { duration: 1.5, hitAt: 0.07 },
  'vorath-void-rupture': { duration: 2.3, hitAt: 0.83 },
  'general-combat-impact': { duration: 1.0, hitAt: 0.08 },
  // Som antigo do projeto do curso, mantido até existir um nocaute próprio.
  knockout: { duration: 3.94, hitAt: 0 },
};

/** Trecho de um arquivo usado num golpe de uma habilidade com vários danos. */
export interface Segment {
  from: number;
  /** Fim do trecho; sem valor, vai até o fim do arquivo. */
  to?: number;
  hitAt: number;
}

export interface SoundCue {
  character: CharacterId;
  clip: ClipId;
  /**
   * Com que momento da coreografia o `hitAt` do arquivo coincide:
   * `launch` = disparo, golpe no chão ou saída do projétil; `impact` = contato com o alvo.
   */
  sync: 'launch' | 'impact';
  /**
   * `release`: o som é do disparo ou da conjuração e toca mesmo que o alvo esquive.
   * `impact`: o som contém o golpe confirmado; numa esquiva, ele não chega a esse ponto.
   */
  kind: 'release' | 'impact';
  /** Um trecho por dano, quando a habilidade acerta mais de uma vez (Rajada Perfurante). */
  segments?: readonly Segment[];
}

/**
 * Som de cada habilidade. A chave é o id da habilidade; quando a forma ativa muda o som,
 * usa-se `id@forma` (a Nyxara e a Vaelith compartilham ids, mas não a identidade sonora).
 */
export const ABILITY_CUES: Readonly<Record<string, SoundCue>> = {
  'astral-orb': { character: 'lyra', clip: 'lyra-astral-orb', sync: 'launch', kind: 'release' },
  supernova: { character: 'lyra', clip: 'lyra-supernova', sync: 'impact', kind: 'impact' },
  'piercing-burst': {
    character: 'vexra',
    clip: 'vexra-piercing-burst',
    sync: 'launch',
    kind: 'release',
    segments: [
      { from: 0, to: 0.22, hitAt: 0.01 },
      { from: 0.22, hitAt: 0.26 },
    ],
  },
  'explosive-grenade': { character: 'vexra', clip: 'vexra-explosive-grenade', sync: 'impact', kind: 'impact' },
  'devastating-blow': { character: 'dravenor', clip: 'dravenor-devastating-blow', sync: 'impact', kind: 'impact' },
  // O machado bate no chão no começo da animação; a rachadura e o tremor seguem o eco do som.
  'earth-rupture': { character: 'dravenor', clip: 'dravenor-earth-rupture', sync: 'launch', kind: 'release' },
  'arcane-blade': { character: 'kael', clip: 'kael-arcane-blade', sync: 'impact', kind: 'impact' },
  'dimensional-cut': { character: 'kael', clip: 'kael-dimensional-cut', sync: 'impact', kind: 'impact' },
  'shadow-blade': { character: 'nyxara', clip: 'nyxara-shadow-blade', sync: 'impact', kind: 'impact' },
  'shadow-blade@eclipse': { character: 'nyxara', clip: 'vaelith-shadow-blade', sync: 'impact', kind: 'impact' },
  'abyss-impact': { character: 'vorath', clip: 'vorath-abyss-impact', sync: 'impact', kind: 'impact' },
  'void-rupture': { character: 'vorath', clip: 'vorath-void-rupture', sync: 'impact', kind: 'impact' },
};

/** Cada disparo real da torre (dano `turret` registrado pelo motor). */
export const TURRET_SHOT_CUE: SoundCue = {
  character: 'vexra',
  clip: 'vexra-auto-turret-shot',
  sync: 'launch',
  kind: 'release',
};

/** Habilidades cujo som pertence à troca de forma, e não ao uso da habilidade. */
export const FORM_CHANGE_ABILITIES: ReadonlySet<string> = new Set(['eclipse']);

/** Som da entrada em cada forma alternativa (a volta à forma base usa o som sintetizado). */
export const FORM_CLIPS: Readonly<Record<string, ClipId>> = {
  eclipse: 'nyxara-eclipse',
};

export const GENERIC_IMPACT: ClipId = 'general-combat-impact';
export const KNOCKOUT: ClipId = 'knockout';

/** Ajustes do impacto genérico conforme a origem do dano. */
export const IMPACT_GAIN_DB = {
  basic: 0,
  counter: 0,
  /** Queimadura e sangramento: um eco discreto, não um golpe. */
  periodic: -9,
  /** Reforço do crítico: um pouco mais alto, sem exagero (o tom sintetizado completa). */
  critical: 2,
} as const;

/** Som da habilidade na forma informada, ou `null` quando ela usa o som sintetizado. */
export function abilityCue(abilityId: string, form = 'base'): SoundCue | null {
  if (form !== 'base') {
    const formCue = ABILITY_CUES[`${abilityId}@${form}`];
    if (formCue) return formCue;
  }
  return ABILITY_CUES[abilityId] ?? null;
}

/** Arquivos que podem tocar numa luta entre os personagens informados (para pré-carregar só eles). */
export function clipsFor(characters: readonly CharacterId[]): ClipId[] {
  const clips = new Set<ClipId>([GENERIC_IMPACT, KNOCKOUT]);
  for (const cue of [...Object.values(ABILITY_CUES), TURRET_SHOT_CUE]) {
    if (characters.includes(cue.character)) clips.add(cue.clip);
  }
  if (characters.includes('nyxara')) for (const clip of Object.values(FORM_CLIPS)) clips.add(clip);
  return [...clips];
}
