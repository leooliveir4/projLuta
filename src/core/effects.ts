import type { EffectTemplate } from './types.ts';

/**
 * Catálogo de efeitos temporários. A duração conta os turnos próprios de quem recebe
 * o efeito. Reaplicar o mesmo id renova a duração e substitui os valores, sem acumular.
 */
export const EFFECTS = {
  /* Lyra */
  starFissure: {
    id: 'star-fissure',
    name: 'Fissura Estelar',
    description: 'Defesa reduzida em 20%.',
    kind: 'debuff',
    duration: 2,
    statModifiers: { defense: -0.2 },
  },
  disorientation: {
    id: 'disorientation',
    name: 'Desorientação',
    description: 'Ataque reduzido em 20%.',
    kind: 'debuff',
    duration: 2,
    statModifiers: { attack: -0.2 },
  },
  astralShield: {
    id: 'astral-shield',
    name: 'Escudo Astral',
    description: 'Dano direto sofrido reduzido em 35%.',
    kind: 'buff',
    duration: 2,
    damageTakenModifier: -0.35,
  },

  /* Vexra */
  autoTurret: {
    id: 'auto-turret',
    name: 'Torre Automática',
    description: 'Causa 30 de dano fixo ao adversário no início de cada turno de Vexra.',
    kind: 'buff',
    duration: 3,
    turretDamage: 30,
  },
  overload: {
    id: 'overload',
    name: 'Sobrecarga',
    description: 'Ataque +40%.',
    kind: 'buff',
    duration: 3,
    statModifiers: { attack: 0.4 },
  },

  /* Dravenor */
  sundered: {
    id: 'sundered',
    name: 'Armadura Rachada',
    description: 'Defesa reduzida em 15%.',
    kind: 'debuff',
    duration: 2,
    statModifiers: { defense: -0.15 },
  },
  ironSkin: {
    id: 'iron-skin',
    name: 'Pele de Ferro',
    description: 'Defesa +35%.',
    kind: 'buff',
    duration: 2,
    statModifiers: { defense: 0.35 },
  },
  ancestralFury: {
    id: 'ancestral-fury',
    name: 'Fúria Ancestral',
    description: 'Ataque +20%.',
    kind: 'buff',
    duration: 2,
    statModifiers: { attack: 0.2 },
  },
  stunned: {
    id: 'stunned',
    name: 'Atordoado',
    description: 'Perde o próximo turno.',
    kind: 'debuff',
    duration: 1,
    stun: true,
  },

  /* Kael */
  openGuard: {
    id: 'open-guard',
    name: 'Guarda Aberta',
    description: 'Defesa reduzida em 15%.',
    kind: 'debuff',
    duration: 2,
    statModifiers: { defense: -0.15 },
  },
  etherealStep: {
    id: 'ethereal-step',
    name: 'Passo Etéreo',
    description: '+35 pontos percentuais de esquiva contra o próximo ataque direto (máximo de 50%); se esquivar, Kael revida.',
    kind: 'buff',
    duration: 1,
    dodgeBonus: 0.35,
    counterOnDodge: 1,
    consumeOn: 'direct-attack',
  },
  perfectDuel: {
    id: 'perfect-duel',
    name: 'Duelo Perfeito',
    description: 'Ataque +35% e velocidade +20%.',
    kind: 'buff',
    duration: 3,
    statModifiers: { attack: 0.35, speed: 0.2 },
  },

  /* Nyxara: forma normal e forma do Eclipse compartilham os ids */
  abyssMark: {
    id: 'abyss-mark',
    name: 'Marca do Abismo',
    description: 'Defesa reduzida em 25%.',
    kind: 'debuff',
    duration: 2,
    statModifiers: { defense: -0.25 },
  },
  profaneMark: {
    id: 'abyss-mark',
    name: 'Marca Profana',
    description: 'Defesa reduzida em 30% e dano direto recebido +10%.',
    kind: 'debuff',
    duration: 2,
    statModifiers: { defense: -0.3 },
    damageTakenModifier: 0.1,
  },
  spectralVeil: {
    id: 'nyx-veil',
    name: 'Véu Espectral',
    description: '+35 pontos percentuais de esquiva contra o próximo ataque direto (máximo de 50%); se esquivar, Vaelith ganha influência.',
    kind: 'buff',
    duration: 1,
    dodgeBonus: 0.35,
    consumeOn: 'direct-attack',
  },
  massacreVeil: {
    id: 'nyx-veil',
    name: 'Véu do Massacre',
    description: '+35 pontos percentuais de esquiva contra o próximo ataque direto; se ele acertar, Nyxara revida.',
    kind: 'buff',
    duration: 1,
    dodgeBonus: 0.35,
    counterPower: 1,
    consumeOn: 'direct-attack',
  },

  /* Vorath */
  abyssSlow: {
    id: 'abyss-slow',
    name: 'Lentidão',
    description: 'Velocidade reduzida em 25%.',
    kind: 'debuff',
    duration: 2,
    statModifiers: { speed: -0.25 },
  },
  voidTorpor: {
    id: 'void-torpor',
    name: 'Torpor do Vazio',
    description: 'Velocidade reduzida em 35%.',
    kind: 'debuff',
    duration: 2,
    statModifiers: { speed: -0.35 },
  },
  unstableMass: {
    id: 'unstable-mass',
    name: 'Massa Instável',
    description: 'Defesa +25%.',
    kind: 'buff',
    duration: 2,
    statModifiers: { defense: 0.25 },
  },

  /* Itens */
  strength: {
    id: 'strength',
    name: 'Força',
    description: 'Ataque +20%.',
    kind: 'buff',
    duration: 3,
    statModifiers: { attack: 0.2 },
  },
} satisfies Record<string, EffectTemplate>;

export function burnEffect(damagePerTurn: number): EffectTemplate {
  return {
    id: 'burn',
    name: 'Queimadura',
    description: `Sofre ${damagePerTurn} de dano no início de cada turno (ignora defesa e guarda).`,
    kind: 'debuff',
    duration: 2,
    periodicDamage: damagePerTurn,
  };
}

export function bleedEffect(damagePerTurn: number): EffectTemplate {
  return {
    id: 'bleed',
    name: 'Sangramento',
    description: `Sofre ${damagePerTurn} de dano no início de cada turno (ignora defesa e guarda).`,
    kind: 'debuff',
    duration: 2,
    periodicDamage: damagePerTurn,
  };
}
