import type { Character } from './Character.ts';
import type { DamageKind } from './types.ts';

/** Constantes das regras de combate, reunidas para facilitar o balanceamento. */
export const COMBAT_RULES = {
  baseCritChance: 0.1,
  critMultiplier: 1.5,
  baseDodgeChance: 0.05,
  dodgePerSpeedPoint: 0.01,
  minDodgeChance: 0.02,
  maxDodgeChance: 0.2,
  /** Teto da esquiva quando há bônus de habilidades. */
  maxBoostedDodgeChance: 0.5,
  basicVariance: 0.1,
  guardReduction: 0.5,
  /** Soma máxima das reduções de dano recebido fora da guarda. */
  maxDamageReduction: 0.6,
  defenseScale: 100,
  minStatMultiplier: 0.25,
} as const;

/** Fração do dano que atravessa a defesa: 100 de defesa reduz o dano pela metade. */
export function mitigationFactor(defense: number): number {
  return COMBAT_RULES.defenseScale / (COMBAT_RULES.defenseScale + Math.max(0, defense));
}

/** Chance de esquiva pela diferença de velocidade, somada a bônus temporários. */
export function dodgeChance(attackerSpeed: number, defenderSpeed: number, bonus = 0): number {
  const base = clamp(
    COMBAT_RULES.baseDodgeChance + (defenderSpeed - attackerSpeed) * COMBAT_RULES.dodgePerSpeedPoint,
    COMBAT_RULES.minDodgeChance,
    COMBAT_RULES.maxDodgeChance,
  );
  if (bonus <= 0) return base;
  return Math.min(COMBAT_RULES.maxBoostedDodgeChance, base + bonus);
}

export interface DamageInput {
  attack: number;
  defense: number;
  power: number;
  /** Rolagem de variação em [0, 1); 0.5 equivale a nenhuma variação. */
  varianceRoll: number;
  critical: boolean;
  guarded: boolean;
  dealtModifier: number;
  takenModifier: number;
  applyVariance: boolean;
}

/** Cálculo puro do dano direto. Ataques básicos variam ±10%; habilidades não variam. */
export function computeDamage(input: DamageInput): number {
  let damage = input.attack * input.power;
  if (input.applyVariance) {
    damage *= 1 + (input.varianceRoll * 2 - 1) * COMBAT_RULES.basicVariance;
  }
  if (input.critical) damage *= COMBAT_RULES.critMultiplier;
  damage *= mitigationFactor(input.defense);
  damage *= Math.max(0, 1 + input.dealtModifier);
  damage *= 1 + Math.max(-COMBAT_RULES.maxDamageReduction, input.takenModifier);
  if (input.guarded) damage *= 1 - COMBAT_RULES.guardReduction;
  return Math.max(1, Math.round(damage));
}

/**
 * Dano médio esperado sem aleatoriedade, considerando crítico e esquiva quando eles
 * se aplicam. Usado pela IA e pela interface para prever resultados.
 */
export function expectedDamage(
  source: Character,
  target: Character,
  power: number,
  kind: DamageKind,
  options: { pessimistic?: boolean; defenseIgnore?: number; ignoreGuard?: boolean } = {},
): number {
  const isBasic = kind === 'basic';
  const base = computeDamage({
    attack: source.attack,
    defense: target.defense * (1 - (options.defenseIgnore ?? 0)),
    power,
    varianceRoll: options.pessimistic ? 0 : 0.5,
    critical: false,
    guarded: target.isGuarding && !options.ignoreGuard,
    dealtModifier: source.outgoingDamageModifier(kind),
    takenModifier: target.incomingDamageModifier(kind),
    applyVariance: isBasic,
  });
  if (options.pessimistic) return base;
  const evasion = target.evasionEffect;
  const canDodge = isBasic || (kind === 'ability' && evasion !== undefined);
  const hitChance = canDodge ? 1 - target.dodgeChanceAgainst(source, evasion?.dodgeBonus ?? 0) : 1;
  const critFactor = isBasic ? 1 + source.critChance * (COMBAT_RULES.critMultiplier - 1) : 1;
  return base * critFactor * hitChance;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
