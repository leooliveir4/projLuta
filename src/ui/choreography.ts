import type { CharacterId } from '../core/types.ts';

/**
 * Coreografia das ações: como cada golpe é apresentado na arena. É só apresentação;
 * as regras continuam no motor. Este módulo não acessa o DOM, então pode ser testado.
 */

/** Como o lutador chega ao alvo. */
export type Approach =
  /** Avança até o adversário, golpeia e volta. */
  | 'melee'
  /** Dispara um projétil da arma (pontos `muzzle` de art.ts). */
  | 'ranged'
  /** Conjura no lugar; o efeito aparece no alvo. */
  | 'cast'
  /** Fortalece a si mesmo, sem alvo. */
  | 'self';

export type ProjectileKind = 'orb' | 'bullet' | 'grenade' | 'nova';

export type ImpactKind =
  | 'burst'
  | 'slash'
  | 'cross'
  | 'claw'
  | 'heavy'
  | 'explosion'
  | 'stars'
  | 'tear'
  | 'implosion'
  | 'shockwave'
  | 'sigil'
  | 'drain';

/** Efeito no próprio lutador, para habilidades sem alvo. */
export type SelfKind = 'shield' | 'turret' | 'power' | 'armor' | 'fury' | 'step' | 'veil' | 'eclipse';

export interface Move {
  approach: Approach;
  projectile?: ProjectileKind;
  impact?: ImpactKind;
  self?: SelfKind;
  /** Energia acumulada na arma antes do disparo (golpes finais). */
  charge?: boolean;
  /** Intensidade do tremor da arena no impacto (0 a 3). */
  shake?: 0 | 1 | 2 | 3;
  /** Clarão na tela inteira no impacto. */
  flash?: boolean;
  /** Onda que corre pelo chão até o alvo (Ruptura da Terra). */
  groundWave?: boolean;
}

/** Ataque básico de cada personagem. */
export const BASIC_MOVES: Record<CharacterId, Move> = {
  lyra: { approach: 'ranged', projectile: 'orb', impact: 'burst' },
  vexra: { approach: 'ranged', projectile: 'bullet', impact: 'burst' },
  dravenor: { approach: 'melee', impact: 'heavy', shake: 1 },
  kael: { approach: 'melee', impact: 'slash' },
  nyxara: { approach: 'melee', impact: 'slash' },
  vorath: { approach: 'melee', impact: 'claw', shake: 1 },
};

/**
 * Habilidades, pelo id. As versões do Eclipse compartilham o id com as normais;
 * a diferença visual vem das cores e da arte da forma.
 */
export const ABILITY_MOVES: Record<string, Move> = {
  /* Lyra */
  'astral-orb': { approach: 'ranged', projectile: 'orb', impact: 'burst', shake: 1 },
  'star-field': { approach: 'cast', impact: 'stars' },
  'arcane-barrier': { approach: 'self', self: 'shield' },
  supernova: { approach: 'ranged', projectile: 'nova', impact: 'explosion', charge: true, shake: 3, flash: true },

  /* Vexra */
  'piercing-burst': { approach: 'ranged', projectile: 'bullet', impact: 'burst' },
  'explosive-grenade': { approach: 'ranged', projectile: 'grenade', impact: 'explosion', shake: 2 },
  'auto-turret': { approach: 'self', self: 'turret' },
  overload: { approach: 'self', self: 'power' },

  /* Dravenor */
  'devastating-blow': { approach: 'melee', impact: 'heavy', shake: 2 },
  'iron-skin': { approach: 'self', self: 'armor' },
  'ancestral-fury': { approach: 'self', self: 'fury' },
  'earth-rupture': { approach: 'cast', impact: 'shockwave', groundWave: true, shake: 3 },

  /* Kael */
  'arcane-blade': { approach: 'melee', impact: 'cross' },
  'ethereal-step': { approach: 'self', self: 'step' },
  'perfect-duel': { approach: 'self', self: 'power' },
  'dimensional-cut': { approach: 'melee', impact: 'tear', shake: 2, flash: true },

  /* Nyxara e Vaelith */
  'shadow-blade': { approach: 'melee', impact: 'cross' },
  'abyss-mark': { approach: 'cast', impact: 'sigil' },
  'nyx-veil': { approach: 'self', self: 'veil' },
  eclipse: { approach: 'self', self: 'eclipse' },

  /* Vorath */
  'abyss-impact': { approach: 'melee', impact: 'claw', shake: 2 },
  assimilation: { approach: 'melee', impact: 'drain' },
  'unstable-mass': { approach: 'self', self: 'armor' },
  'void-rupture': { approach: 'cast', impact: 'implosion', charge: true, shake: 3, flash: true },
};

/** Coreografia de uma ação; habilidades sem entrada usam um padrão seguro pelo alvo. */
export function moveFor(characterId: CharacterId, abilityId: string | null, target: 'self' | 'enemy' = 'enemy'): Move {
  if (!abilityId) return BASIC_MOVES[characterId];
  return ABILITY_MOVES[abilityId] ?? (target === 'self' ? { approach: 'self', self: 'power' } : { approach: 'cast', impact: 'burst' });
}

/**
 * Estados persistentes desenhados no lutador enquanto o efeito durar, pelo id do efeito.
 * Cada classe CSS (`has-...`) liga uma camada visual em `.combatant__status`.
 */
export const STATUS_CLASSES: Record<string, string> = {
  burn: 'has-burn',
  bleed: 'has-bleed',
  'astral-shield': 'has-shield',
  'auto-turret': 'has-turret',
  overload: 'has-power',
  'perfect-duel': 'has-power',
  'ancestral-fury': 'has-power',
  strength: 'has-power',
  'iron-skin': 'has-armor',
  'unstable-mass': 'has-armor',
  'abyss-mark': 'has-mark',
  'nyx-veil': 'has-veil',
  'ethereal-step': 'has-veil',
  'abyss-slow': 'has-slow',
  'void-torpor': 'has-slow',
};

/** Todas as classes de estado, para limpar antes de aplicar as atuais. */
export const ALL_STATUS_CLASSES: readonly string[] = [...new Set(Object.values(STATUS_CLASSES))];
